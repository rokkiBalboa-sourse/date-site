import http.server
import socketserver
import json
import sqlite3
import os
import urllib.request
import urllib.parse
from datetime import datetime

PORT = int(os.environ.get('PORT', 3000))
DB_FILE = os.environ.get('DB_FILE', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'date_site.db'))

DEFAULT_BOT_TOKEN = os.environ.get('BOT_TOKEN', "8903395064:AAGlisAhpTqcIPegqZDKxYKmjwhjqZMdBsM")
DEFAULT_CHAT_ID = os.environ.get('CHAT_ID', "330200492")

def init_db():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS date_response (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            activity TEXT NOT NULL,
            food TEXT NOT NULL,
            datetime TEXT NOT NULL,
            raw_date TEXT,
            selected_time TEXT,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    ''')
    conn.commit()
    conn.close()

def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def get_latest_response():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM date_response ORDER BY id DESC LIMIT 1')
    row = cursor.fetchone()
    conn.close()
    if row:
        return {
            'confirmed': True,
            'plan': {
                'activity': row['activity'],
                'food': row['food'],
                'datetime': row['datetime'],
                'rawDate': row['raw_date'],
                'selectedTime': row['selected_time'],
                'notes': row['notes']
            },
            'createdAt': row['created_at']
        }
    return {'confirmed': False, 'plan': None}

def save_response(data):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO date_response (activity, food, datetime, raw_date, selected_time, notes)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (
        data.get('activity', ''),
        data.get('food', ''),
        data.get('datetime', ''),
        data.get('rawDate', ''),
        data.get('selectedTime', ''),
        data.get('notes', '')
    ))
    conn.commit()
    conn.close()

def reset_db_responses():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM date_response')
    conn.commit()
    conn.close()

import html
import threading
import time

def send_telegram_notification(bot_token, chat_id, text_html, reply_markup=None):
    if not bot_token or not chat_id:
        return False
    try:
        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        payload_dict = {
            'chat_id': chat_id,
            'text': text_html,
            'parse_mode': 'HTML'
        }
        if reply_markup:
            payload_dict['reply_markup'] = reply_markup
        payload = json.dumps(payload_dict).encode('utf-8')
        req = urllib.request.Request(url, data=payload, headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status == 200
    except Exception as e:
        print(f"Telegram error: {e}")
        return False

def answer_callback_query(bot_token, callback_query_id, text=None):
    try:
        url = f"https://api.telegram.org/bot{bot_token}/answerCallbackQuery"
        payload_dict = {'callback_query_id': callback_query_id}
        if text:
            payload_dict['text'] = text
        payload = json.dumps(payload_dict).encode('utf-8')
        req = urllib.request.Request(url, data=payload, headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status == 200
    except Exception as e:
        print(f"answerCallbackQuery error: {e}")
        return False

def telegram_bot_poller():
    """Background worker that listens for inline button clicks and commands."""
    offset = 0
    bot_token = DEFAULT_BOT_TOKEN
    print("Telegram bot poller started.")
    while True:
        try:
            url = f"https://api.telegram.org/bot{bot_token}/getUpdates?offset={offset}&timeout=20"
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                if data.get('ok'):
                    for update in data.get('result', []):
                        update_id = update['update_id']
                        offset = max(offset, update_id + 1)

                        # Handle button clicks
                        if 'callback_query' in update:
                            cq = update['callback_query']
                            cq_id = cq['id']
                            cq_data = cq.get('data')
                            from_chat_id = cq.get('message', {}).get('chat', {}).get('id') or cq.get('from', {}).get('id')

                            if cq_data == 'reset_db':
                                reset_db_responses()
                                answer_callback_query(bot_token, cq_id, text="База данных успешно сброшена! 🔄")
                                send_telegram_notification(
                                    bot_token,
                                    from_chat_id,
                                    "🔄 <b>База данных свидания успешно сброшена!</b>\n\nСайт снова ждёт ответа Кристины 💜"
                                )

                        # Handle text commands
                        elif 'message' in update:
                            msg = update['message']
                            chat_id = msg.get('chat', {}).get('id')
                            text = msg.get('text', '').strip()

                            if text.startswith('/reset'):
                                reset_db_responses()
                                send_telegram_notification(
                                    bot_token,
                                    chat_id,
                                    "🔄 <b>База данных свидания успешно сброшена!</b>\n\nСайт готов к повторному заполнению: http://localhost:3000"
                                )
                            elif text.startswith('/start'):
                                keyboard = {
                                    'inline_keyboard': [
                                        [{'text': '🔄 Сбросить БД сайта', 'callback_data': 'reset_db'}]
                                    ]
                                }
                                send_telegram_notification(
                                    bot_token,
                                    chat_id,
                                    "👋 <b>Привет!</b> Я бот для свидания с Кристиной 💜\n\n"
                                    "Когда она заполнит форму, сюда придёт её ответ с кнопкой сброса.\n"
                                    "Ты также можешь сбросить базу данных в любой момент кнопкой ниже или командой /reset:",
                                    reply_markup=keyboard
                                )
        except Exception as e:
            # Network blip or timeout, wait a bit and retry
            time.sleep(3)

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Prevent caching for API routes
        if self.path.startswith('/api/'):
            self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()

    def do_GET(self):
        if self.path == '/api/status':
            status = get_latest_response()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps(status, ensure_ascii=False).encode('utf-8'))
            return

        # Serve static files
        super().do_GET()

    def do_POST(self):
        if self.path == '/api/save':
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8')
            try:
                data = json.loads(body)
                save_response(data)

                # Send Telegram notification directly to user's Telegram with Reset DB button
                bot_token = data.get('botToken') or DEFAULT_BOT_TOKEN
                chat_id = data.get('chatId') or DEFAULT_CHAT_ID
                tg_ok = False
                if bot_token and chat_id:
                    activity = data.get('activity', '')
                    food = data.get('food', '')
                    full_dt = data.get('datetime', '')
                    notes = data.get('notes', '')
                    msg = (
                        f"💌 <b>Кристина приняла приглашение на свидание!</b> 💜\n\n"
                        f"✨ <b>Активность:</b> {html.escape(str(activity))}\n"
                        f"🍓 <b>Вкусняшки:</b> {html.escape(str(food))}\n"
                        f"🗓️ <b>Когда:</b> {html.escape(str(full_dt))}\n"
                    )
                    if notes:
                        msg += f"💭 <b>Пожелание:</b> {html.escape(str(notes))}\n"
                    else:
                        msg += "💭 <b>Пожелание:</b> <i>Не указано</i>\n"
                    msg += "\n💖 <i>Официально сохранено в БД на сервере!</i>"

                    reset_keyboard = {
                        'inline_keyboard': [
                            [
                                {'text': '🔄 Сбросить БД сайта', 'callback_data': 'reset_db'}
                            ]
                        ]
                    }
                    tg_ok = send_telegram_notification(bot_token, chat_id, msg, reply_markup=reset_keyboard)

                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({'ok': True, 'telegram_sent': tg_ok, 'message': 'Saved to SQLite database!'}, ensure_ascii=False).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({'ok': False, 'error': str(e)}).encode('utf-8'))
            return

        elif self.path == '/api/reset':
            reset_db_responses()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({'ok': True, 'message': 'Database reset successfully!'}).encode('utf-8'))
            return

        self.send_response(404)
        self.end_headers()

def run_server():
    init_db()
    
    # Start Telegram bot polling thread
    poller_thread = threading.Thread(target=telegram_bot_poller, daemon=True)
    poller_thread.start()

    socketserver.TCPServer.allow_reuse_address = True
    while True:
        try:
            with socketserver.TCPServer(("", PORT), CustomHandler) as httpd:
                print(f"Server with SQLite database running at http://localhost:{PORT}", flush=True)
                httpd.serve_forever()
        except KeyboardInterrupt:
            break
        except Exception as e:
            print(f"Server error: {e}", flush=True)
            time.sleep(1)

if __name__ == '__main__':
    run_server()
