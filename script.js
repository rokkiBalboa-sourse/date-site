/**
 * Romantic Date Invitation for Kristina
 * Updated with staged reveal, mobile runaway button disappearance after 5 clicks,
 * surprise skip logic, time picker, and custom webm stickers.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const screenInvite = document.getElementById('screen-invite');
  const screenPlanner = document.getElementById('screen-planner');
  const screenResult = document.getElementById('screen-result');

  const stage1 = document.getElementById('stage-1');
  const stage2 = document.getElementById('stage-2');
  const stage3 = document.getElementById('stage-3');

  const btnYes = document.getElementById('btn-yes');
  const btnNo = document.getElementById('btn-no');
  const teaseText = document.getElementById('tease-text');

  // Wizard steps
  const wizardStep1 = document.getElementById('wizard-step-1');
  const wizardStep2 = document.getElementById('wizard-step-2');
  const wizardStep3 = document.getElementById('wizard-step-3');
  const wizardStep4 = document.getElementById('wizard-step-4');
  const stepDots = document.querySelectorAll('.step-dot');

  const btnNext1 = document.getElementById('btn-next-1');
  const btnNext2 = document.getElementById('btn-next-2');
  const btnNext3 = document.getElementById('btn-next-3');
  const btnPrev2 = document.getElementById('btn-prev-2');
  const btnPrev3 = document.getElementById('btn-prev-3');
  const btnPrev4 = document.getElementById('btn-prev-4');
  const btnSubmitPlan = document.getElementById('btn-submit-plan');

  // Ticket Summary
  const summaryActivity = document.getElementById('summary-activity');
  const summaryFood = document.getElementById('summary-food');
  const summaryDatetime = document.getElementById('summary-datetime');
  const summaryMeeting = document.getElementById('summary-meeting');
  const summaryNotesRow = document.getElementById('summary-notes-row');
  const summaryNotes = document.getElementById('summary-notes');

  // Telegram Status & Actions
  const tgStatusBox = document.getElementById('tg-status-box');
  const tgSpinner = document.getElementById('tg-spinner');
  const tgStatusText = document.getElementById('tg-status-text');
  const btnOpenTelegram = document.getElementById('btn-open-telegram');
  const btnAddCalendar = document.getElementById('btn-add-calendar');

  // Config Modal Elements
  const btnConfig = document.getElementById('btn-config');
  const modalConfig = document.getElementById('modal-config');
  const modalClose = document.getElementById('modal-close');
  const btnSaveConfig = document.getElementById('btn-save-config');
  const btnResetPlan = document.getElementById('btn-reset-plan');
  const cfgBotToken = document.getElementById('cfg-bot-token');
  const cfgChatId = document.getElementById('cfg-chat-id');

  // Date and Time inputs
  const dateInput = document.getElementById('date-select');
  const timeInput = document.getElementById('time-select');
  const quickDaysContainer = document.getElementById('quick-days-container');
  const mainNotesInput = document.getElementById('notes-input');
  const mainNotesError = document.getElementById('notes-error');

  if (mainNotesInput) {
    mainNotesInput.addEventListener('input', () => {
      if (mainNotesInput.value.trim()) {
        mainNotesInput.classList.remove('input-error');
        if (mainNotesError) mainNotesError.style.display = 'none';
      }
    });
  }

  // State
  let yesScale = 1;
  let noAttempts = 0;
  const dodgePhrases = [
    'Кажется, рука дрогнула! 😉',
    'Кнопка «Да» явно симпатичнее 💜',
    'Хитрый план не сработает! 😄',
    'Ой, эта кнопочка сломалась 🙈',
    'Судьба намекает на «Да»! ✨'
  ];

  // Config loading
  const urlParams = new URLSearchParams(window.location.search);
  let config = {
    botToken: urlParams.get('token') || localStorage.getItem('date_tg_token') || '8903395064:AAGlisAhpTqcIPegqZDKxYKmjwhjqZMdBsM',
    chatId: urlParams.get('chat_id') || localStorage.getItem('date_tg_chat_id') || '330200492'
  };

  if (cfgBotToken) cfgBotToken.value = config.botToken;
  if (cfgChatId) cfgChatId.value = config.chatId;

  // ==========================================
  // 0. CHECK SERVER SQLITE DATABASE & STATE
  // ==========================================
  function applyConfirmedPlan(plan) {
    summaryActivity.textContent = plan.activity || '—';
    summaryFood.textContent = plan.food || '—';
    summaryDatetime.textContent = plan.datetime || '—';
    if (summaryMeeting) summaryMeeting.textContent = plan.meeting || 'Заеду за тобой на такси / машине';
    summaryNotesRow.style.display = 'flex';
    summaryNotes.innerHTML = 'Твой член <video class="inline-emoji-video" src="fuck.webm" autoplay loop muted playsinline></video>';

    setupCalendarDownload(plan.rawDate, plan.selectedTime, plan.activity, plan.food, plan.meeting);

    screenInvite.style.display = 'none';
    screenInvite.classList.remove('active');
    screenPlanner.style.display = 'none';
    screenPlanner.classList.remove('active');

    screenResult.style.display = 'block';
    screenResult.classList.add('active');
    if (tgStatusBox) {
      tgStatusBox.style.display = 'flex';
      if (tgSpinner) tgSpinner.style.display = 'none';
      if (tgStatusText) tgStatusText.textContent = 'Всё записал, буду ждать с нетерпением 🥰';
      tgStatusBox.style.borderColor = 'rgba(74, 222, 128, 0.5)';
      tgStatusBox.style.background = 'rgba(74, 222, 128, 0.1)';
    }
  }

  async function checkServerStatus() {
    initFloatingHearts();
    initSettingsModal();

    // 1. First check server SQLite DB
    try {
      const resp = await fetch('/api/status');
      if (resp.ok) {
        const data = await resp.json();
        if (data.confirmed && data.plan) {
          applyConfirmedPlan(data.plan);
          return;
        }
      }
    } catch (e) {
      console.log('Server API check offline, checking local backup...');
    }

    // 2. Check localStorage backup
    const savedConfirmedPlan = localStorage.getItem('date_kristina_confirmed');
    if (savedConfirmedPlan) {
      try {
        const plan = JSON.parse(savedConfirmedPlan);
        applyConfirmedPlan(plan);
        return;
      } catch (err) {}
    }

    // 3. Not confirmed yet: start initial sequential reveal
    startInitialScreenStages();
  }

  // ==========================================
  // 1. FLOATING HEARTS BACKGROUND
  // ==========================================
  function initFloatingHearts() {
    const heartsContainer = document.getElementById('hearts-container');
    const heartSymbols = ['💜', '✨', '🌸', '💖', '🔮', '🧸'];

    function createFloatingHeart() {
      if (!heartsContainer) return;
      const heart = document.createElement('div');
      heart.className = 'floating-heart';
      heart.textContent = heartSymbols[Math.floor(Math.random() * heartSymbols.length)];
      heart.style.left = `${Math.random() * 96 + 2}%`;
      const duration = Math.random() * 4 + 5;
      heart.style.animationDuration = `${duration}s`;
      heart.style.fontSize = `${Math.random() * 14 + 16}px`;

      heartsContainer.appendChild(heart);

      setTimeout(() => {
        heart.remove();
      }, duration * 1000);
    }

    setInterval(createFloatingHeart, 600);
    for (let i = 0; i < 5; i++) {
      createFloatingHeart();
    }
  }

  // ==========================================
  // 2. STAGED SEQUENTIAL REVEAL (Screen 1)
  // Each step appears every 3 seconds
  // ==========================================
  function startInitialScreenStages() {
    const STAGE_INTERVAL_MS = 3000; // 3 seconds between stages

    const timerStage2 = setTimeout(() => {
      stage2.classList.add('revealed');
    }, STAGE_INTERVAL_MS);

    const timerStage3 = setTimeout(() => {
      stage3.classList.add('revealed');
    }, STAGE_INTERVAL_MS * 2);

    screenInvite.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      if (!stage2.classList.contains('revealed')) {
        clearTimeout(timerStage2);
        stage2.classList.add('revealed');
      } else if (!stage3.classList.contains('revealed')) {
        clearTimeout(timerStage3);
        stage3.classList.add('revealed');
      }
    });
  }

  checkServerStatus();

  // ==========================================
  // 3. RUNAWAY "НЕТ" BUTTON (Disappears on 5th tap)
  // ==========================================
  function handleNoInteraction(e) {
    if (e) e.preventDefault();
    noAttempts++;

    // Check if reached 5 attempts
    if (noAttempts >= 5) {
      btnNo.style.transition = 'all 0.35s ease';
      btnNo.style.transform = 'scale(0)';
      btnNo.style.opacity = '0';
      setTimeout(() => {
        btnNo.style.display = 'none';
      }, 350);

      yesScale = 1.25;
      btnYes.style.transform = `scale(${yesScale})`;
      teaseText.textContent = 'Остался только один правильный выбор! 🥰💜';
      teaseText.style.opacity = '1';
      return;
    }

    // Tease text
    const phrase = dodgePhrases[(noAttempts - 1) % dodgePhrases.length];
    teaseText.textContent = phrase;
    teaseText.style.opacity = '1';

    // Grow "Yes"
    yesScale = Math.min(yesScale + 0.08, 1.45);
    btnYes.style.transform = `scale(${yesScale})`;

    // Random dodge offset
    const maxX = 100;
    const maxY = 50;
    const randomX = (Math.random() * 2 - 1) * maxX;
    const randomY = (Math.random() * 2 - 1) * maxY;
    const randomRotate = (Math.random() - 0.5) * 25;

    btnNo.style.position = 'relative';
    btnNo.style.transform = `translate(${randomX}px, ${randomY}px) rotate(${randomRotate}deg) scale(0.92)`;
  }

  btnNo.addEventListener('mouseenter', handleNoInteraction);
  btnNo.addEventListener('touchstart', handleNoInteraction, { passive: false });
  btnNo.addEventListener('click', handleNoInteraction);

  // ==========================================
  // 4. CLICK "ДА" -> OPEN DATE PLANNER
  // ==========================================
  btnYes.addEventListener('click', () => {
    if (window.confetti) {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#a855f7', '#c084fc', '#f472b6', '#ffffff']
      });
    }

    screenInvite.classList.remove('active');
    setTimeout(() => {
      screenInvite.style.display = 'none';
      screenPlanner.style.display = 'block';
      setTimeout(() => {
        screenPlanner.classList.add('active');
      }, 30);
    }, 250);
  });

  // Surprise Inline Banner & Notice Elements
  const surpriseFoodBanner = document.getElementById('surprise-food-banner');
  const btnSurpriseFoodNo = document.getElementById('btn-surprise-food-no');
  const btnSurpriseFoodYes = document.getElementById('btn-surprise-food-yes');
  const step2SurpriseNotice = document.getElementById('step2-surprise-notice');
  const foodOptionCustom = document.getElementById('food-option-custom');
  let foodSurpriseChoice = null; // true: food is surprise; false: chooses food herself

  // ==========================================
  // 5. WIZARD NAVIGATION & SURPRISE LOGIC
  // ==========================================
  function isSurpriseSelected() {
    const act = document.querySelector('input[name="activity"]:checked')?.value || '';
    return act.includes('сюрприз') || act.includes('Сюрприз');
  }

  function updateStep2SurpriseState() {
    if (isSurpriseSelected()) {
      if (step2SurpriseNotice) step2SurpriseNotice.style.display = 'block';
      if (foodOptionCustom) {
        foodOptionCustom.style.display = 'none';
        const customRadio = foodOptionCustom.querySelector('input[type="radio"]');
        if (customRadio && customRadio.checked) {
          const firstRadio = document.querySelector('input[name="food"]');
          if (firstRadio) firstRadio.checked = true;
        }
      }
    } else {
      if (step2SurpriseNotice) step2SurpriseNotice.style.display = 'none';
      if (foodOptionCustom) foodOptionCustom.style.display = 'block';
    }
  }

  // Trigger inline banner inside Step 1 when clicking "Полный сюрприз"
  document.querySelectorAll('input[name="activity"]').forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.value === 'Полный сюрприз') {
        if (surpriseFoodBanner) surpriseFoodBanner.style.display = 'block';
      } else {
        foodSurpriseChoice = null;
        if (surpriseFoodBanner) surpriseFoodBanner.style.display = 'none';
        updateStep2SurpriseState();
      }
    });
  });

  // Surprise food button actions
  if (btnSurpriseFoodNo) {
    btnSurpriseFoodNo.addEventListener('click', () => {
      foodSurpriseChoice = true;
      setWizardStep(3); // Skip step 2, go straight to step 3!
    });
  }

  if (btnSurpriseFoodYes) {
    btnSurpriseFoodYes.addEventListener('click', () => {
      foodSurpriseChoice = false;
      updateStep2SurpriseState();
      setWizardStep(2); // Go to step 2 with notice and without "На твой вкус"
    });
  }

  function setWizardStep(stepNumber) {
    [wizardStep1, wizardStep2, wizardStep3, wizardStep4].forEach((step, idx) => {
      if (step) step.classList.toggle('active', idx + 1 === stepNumber);
    });

    stepDots.forEach((dot, idx) => {
      const stepIndex = idx + 1;
      dot.classList.remove('active', 'completed');
      if (stepIndex === stepNumber) {
        dot.classList.add('active');
      } else if (stepIndex < stepNumber) {
        dot.classList.add('completed');
        dot.innerHTML = '✓';
      } else {
        dot.innerHTML = stepIndex;
      }
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  btnNext1.addEventListener('click', () => {
    if (isSurpriseSelected()) {
      if (foodSurpriseChoice === true) {
        setWizardStep(3);
      } else if (foodSurpriseChoice === false) {
        updateStep2SurpriseState();
        setWizardStep(2);
      } else {
        if (surpriseFoodBanner) surpriseFoodBanner.style.display = 'block';
      }
    } else {
      updateStep2SurpriseState();
      setWizardStep(2);
    }
  });

  btnPrev2.addEventListener('click', () => setWizardStep(1));
  btnNext2.addEventListener('click', () => setWizardStep(3));

  btnPrev3.addEventListener('click', () => {
    if (isSurpriseSelected() && foodSurpriseChoice === true) {
      setWizardStep(1);
    } else {
      setWizardStep(2);
    }
  });

  if (btnNext3) {
    btnNext3.addEventListener('click', () => setWizardStep(4));
  }

  if (btnPrev4) {
    btnPrev4.addEventListener('click', () => setWizardStep(3));
  }

  // ==========================================
  // 6. QUICK DAYS GENERATOR
  // ==========================================
  function setupQuickDays() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    dateInput.min = `${yyyy}-${mm}-${dd}`;
    dateInput.value = `${yyyy}-${mm}-${dd}`;

    const daysLabels = ['Сегодня', 'Завтра', 'В эти выходные'];
    quickDaysContainer.innerHTML = '';

    daysLabels.forEach((label, index) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `quick-day-btn ${index === 1 ? 'selected' : ''}`;
      btn.textContent = label;

      btn.addEventListener('click', () => {
        document.querySelectorAll('.quick-day-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');

        const targetDate = new Date();
        if (index === 0) {
          // today
        } else if (index === 1) {
          // tomorrow
          targetDate.setDate(targetDate.getDate() + 1);
        } else if (index === 2) {
          // nearest Saturday
          const dayOfWeek = targetDate.getDay();
          const daysUntilSat = (6 - dayOfWeek + 7) % 7 || 7;
          targetDate.setDate(targetDate.getDate() + daysUntilSat);
        }

        const y = targetDate.getFullYear();
        const m = String(targetDate.getMonth() + 1).padStart(2, '0');
        const d = String(targetDate.getDate()).padStart(2, '0');
        dateInput.value = `${y}-${m}-${d}`;
      });

      quickDaysContainer.appendChild(btn);
    });

    dateInput.addEventListener('change', () => {
      document.querySelectorAll('.quick-day-btn').forEach(b => b.classList.remove('selected'));
    });
  }

  setupQuickDays();

  // ==========================================
  // 7. SUBMIT PLAN & TICKET GENERATION
  // ==========================================
  btnSubmitPlan.addEventListener('click', async () => {
    const surprise = isSurpriseSelected();
    const selectedActivity = document.querySelector('input[name="activity"]:checked')?.value || 'Романтичный ужин';
    let selectedFood;
    if (surprise) {
      if (foodSurpriseChoice === false) {
        selectedFood = document.querySelector('input[name="food"]:checked')?.value || 'На твой вкус ✨';
      } else {
        selectedFood = 'Сюрприз от тебя 🎁';
      }
    } else {
      selectedFood = document.querySelector('input[name="food"]:checked')?.value || 'Итальянская кухня';
    }
    
    const selectedMeeting = document.querySelector('input[name="meeting"]:checked')?.value || 'Заеду за тобой на такси / машине';
    const selectedTime = timeInput.value ? timeInput.value : '19:00';
    const rawDate = dateInput.value;
    const notesInput = document.getElementById('notes-input');
    const notesError = document.getElementById('notes-error');
    const notes = notesInput ? notesInput.value.trim() : '';

    if (!notes) {
      if (notesInput) {
        notesInput.classList.remove('input-error');
        // trigger reflow for re-animation
        void notesInput.offsetWidth;
        notesInput.classList.add('input-error');
        notesInput.focus();
      }
      if (notesError) {
        notesError.style.display = 'block';
      }
      return;
    }

    // Format date in Russian friendly format
    let dateFormatted = rawDate;
    if (rawDate) {
      const parts = rawDate.split('-');
      const dObj = new Date(parts[0], parts[1] - 1, parts[2]);
      dateFormatted = dObj.toLocaleDateString('ru-RU', {
        weekday: 'short',
        day: 'numeric',
        month: 'long'
      });
    }

    const fullDateTime = `${dateFormatted} в ${selectedTime}`;

    // Fill Ticket
    summaryActivity.textContent = selectedActivity;
    summaryFood.textContent = selectedFood;
    summaryDatetime.textContent = fullDateTime;
    if (summaryMeeting) summaryMeeting.textContent = selectedMeeting;

    summaryNotesRow.style.display = 'flex';
    summaryNotes.innerHTML = 'Твой член <video class="inline-emoji-video" src="fuck.webm" autoplay loop muted playsinline></video>';

    // Switch screen to Result
    screenPlanner.classList.remove('active');
    setTimeout(() => {
      screenPlanner.style.display = 'none';
      screenResult.style.display = 'block';
      setTimeout(() => {
        screenResult.classList.add('active');
      }, 30);
    }, 250);

    // Grand Confetti Blast
    launchGrandConfetti();

    // Prepare message for Telegram bot (contains what Kristina actually typed!)
    const message = 
`💌 *Кристина приняла приглашение на свидание!* 💜

✨ *Активность:* ${selectedActivity}
🍓 *Вкусняшки:* ${selectedFood}
🗓️ *Когда:* ${fullDateTime}
📍 *Где встретимся:* ${selectedMeeting}
💭 *Пожелание:* ${notes ? notes : 'Не указано'}

💖 _Официально подтверждено через date-site!_`;

    // Save confirmed plan to server SQLite database & localStorage
    const savedPlan = {
      activity: selectedActivity,
      food: selectedFood,
      datetime: fullDateTime,
      rawDate: rawDate,
      selectedTime: selectedTime,
      meeting: selectedMeeting,
      notes: notes,
      botToken: config.botToken,
      chatId: config.chatId
    };

    // 1. Post to Server SQLite DB (which saves and sends notification to Telegram bot)
    let savedOnServer = false;
    try {
      const resp = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(savedPlan)
      });
      if (resp.ok) {
        savedOnServer = true;
      }
    } catch (err) {
      console.warn('Could not post to /api/save:', err);
    }

    // 2. Save locally as backup
    localStorage.setItem('date_kristina_confirmed', JSON.stringify(savedPlan));

    // Calendar (.ics)
    setupCalendarDownload(rawDate, selectedTime, selectedActivity, selectedFood, selectedMeeting);

    // Display confirmation status
    if (savedOnServer) {
      tgSpinner.style.display = 'none';
      tgStatusText.textContent = 'Всё записал, буду ждать с нетерпением 🥰';
      tgStatusBox.style.borderColor = 'rgba(74, 222, 128, 0.5)';
      tgStatusBox.style.background = 'rgba(74, 222, 128, 0.1)';
    } else {
      // Fallback: send directly if server is unreachable
      await sendTelegramNotification(message);
    }
  });

  // ==========================================
  // 8. TELEGRAM NOTIFICATION SENDER (FALLBACK)
  // ==========================================
  async function sendTelegramNotification(text) {
    if (!config.botToken || !config.chatId) {
      tgSpinner.style.display = 'none';
      tgStatusText.textContent = 'Всё записал, буду ждать с нетерпением 🥰';
      return;
    }

    tgSpinner.style.display = 'block';
    tgStatusText.textContent = 'Отправляю подтверждение в Telegram...';

    const url = `https://tgproxy.egor4ik-4iter.workers.dev/bot${config.botToken}/sendMessage`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: config.chatId,
          text: text
        })
      });

      const resData = await response.json();
      tgSpinner.style.display = 'none';
      tgStatusText.textContent = 'Всё записал, буду ждать с нетерпением 🥰';
      tgStatusBox.style.borderColor = 'rgba(74, 222, 128, 0.5)';
      tgStatusBox.style.background = 'rgba(74, 222, 128, 0.1)';
    } catch (err) {
      console.warn('Telegram API Error:', err);
      tgSpinner.style.display = 'none';
      tgStatusText.textContent = 'Всё записал, буду ждать с нетерпением 🥰';
      tgStatusBox.style.borderColor = 'rgba(74, 222, 128, 0.5)';
      tgStatusBox.style.background = 'rgba(74, 222, 128, 0.1)';
    }
  }

  // ==========================================
  // 9. GRAND CONFETTI BLAST
  // ==========================================
  function launchGrandConfetti() {
    if (!window.confetti) return;

    const count = 200;
    const defaults = {
      origin: { y: 0.65 },
      colors: ['#a855f7', '#c084fc', '#e879f9', '#f472b6', '#ffffff', '#ffd166']
    };

    function fire(particleRatio, opts) {
      confetti(Object.assign({}, defaults, opts, {
        particleCount: Math.floor(count * particleRatio)
      }));
    }

    fire(0.25, { spread: 26, startVelocity: 55 });
    fire(0.2, { spread: 60 });
    fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
    fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
    fire(0.1, { spread: 120, startVelocity: 45 });
  }

  // ==========================================
  // 10. ICS CALENDAR EVENT GENERATOR
  // ==========================================
  function setupCalendarDownload(rawDate, timeStr, activity, food, meeting) {
    if (!btnAddCalendar) return;
    btnAddCalendar.onclick = () => {
      let dtStart = new Date();
      if (rawDate) {
        const parts = rawDate.split('-');
        dtStart = new Date(parts[0], parts[1] - 1, parts[2]);
      }
      
      const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})/);
      if (timeMatch) {
        dtStart.setHours(parseInt(timeMatch[1], 10), parseInt(timeMatch[2], 10), 0);
      } else {
        dtStart.setHours(19, 0, 0);
      }

      const dtEnd = new Date(dtStart.getTime() + 3 * 60 * 60 * 1000);

      const formatICSDate = (d) => {
        return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      };

      const meetingInfo = meeting ? `\\nВстреча: ${meeting}` : '';

      const icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Date Night with Kristina//RU',
        'CALSCALE:GREGORIAN',
        'BEGIN:VEVENT',
        `SUMMARY:💜 Свидание с Кристиной: ${activity}`,
        `DESCRIPTION:Идеальный вечер! План: ${activity}. Вкусняшки: ${food}.${meetingInfo}`,
        `DTSTART:${formatICSDate(dtStart)}`,
        `DTEND:${formatICSDate(dtEnd)}`,
        'STATUS:CONFIRMED',
        'END:VEVENT',
        'END:VCALENDAR'
      ].join('\r\n');

      const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.setAttribute('download', 'date_with_kristina.ics');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };
  }

  // ==========================================
  // 11. SETTINGS MODAL
  // ==========================================
  function initSettingsModal() {
    if (!btnConfig) return;
    btnConfig.addEventListener('click', () => {
      if (modalConfig) modalConfig.classList.add('active');
    });

    if (modalClose) {
      modalClose.addEventListener('click', () => {
        if (modalConfig) modalConfig.classList.remove('active');
      });
    }

    window.addEventListener('click', (e) => {
      if (e.target === modalConfig) {
        modalConfig.classList.remove('active');
      }
    });

    if (btnSaveConfig) {
      btnSaveConfig.addEventListener('click', () => {
        config.botToken = cfgBotToken.value.trim();
        config.chatId = cfgChatId.value.trim();

        localStorage.setItem('date_tg_token', config.botToken);
        localStorage.setItem('date_tg_chat_id', config.chatId);

        if (modalConfig) modalConfig.classList.remove('active');
        alert('Настройки сохранены!');
      });
    }

    if (btnResetPlan) {
      btnResetPlan.addEventListener('click', async () => {
        try {
          await fetch('/api/reset', { method: 'POST' });
        } catch (e) {
          console.warn('Could not reset server DB:', e);
        }
        localStorage.removeItem('date_kristina_confirmed');
        window.location.reload();
      });
    }
  }
});
