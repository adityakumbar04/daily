// ====================== DATA ======================

const QUESTIONS = [
  { q: "Maine tahajjud ki namaz adaa ki?", options: ["Yes", "No"], audio: "audio/1st.mp3" },
  { q: "Maine roza rakha?", options: ["Yes", "No"], audio: "audio/2nd.mp3" },
  { q: "Maine fajr ki namaz jamat ke saath adaa ki?", options: ["Yes", "No"], audio: "audio/3.mp3" },
  { q: "Maine fajr ke waqt surah yaseen ki tilaawat ki?", options: ["Yes", "No"], audio: "audio/4th.mp3" },
  { q: "Maine saara din ladaal jhagda aur gaali gloch aur jhut se ijtinaab kiya?", options: ["Yes", "No"], audio: "audio/5th.mp3" },
  { q: "Maine Zohar ki namaz jamat ke saath adaa ki?", options: ["Yes", "No"], audio: "audio/6.mp3" },
  { q: "Asar ke baad maine nabi kareem ki khidmat mein 100 martaba darood paak bheja?", options: ["Yes", "No"], audio: "audio/7.mp3" },
  { q: "Maine kam se kam 1 paare ki tilaawat ki?", options: ["Yes", "No"], audio: "audio/8.mp3" },
  { q: "Maine Asar ki namaz jamat ke saath adaa ki?", options: ["Yes", "No"], audio: "audio/9.mp3" },
  { q: "Maine din mein 100 martaba istigfaar kiya?", options: ["Yes", "No"], audio: "audio/10.mp3" },
  { q: "Maine Magrib ki namaz jamat ke saath adaa ki?", options: ["Yes", "No"], audio: "audio/11.mp3" },
  { q: "Maine Isha ki namaz jamat ke saath adaa ki aur taraveed bhi padi?", options: ["Yes", "No"], audio: "audio/12.mp3" },
  { q: "Vaalidain ki khidmat ki?", options: ["Yes", "No"], audio: "audio/13.mp3" },
  { q: "Kisi musalman bhai ko apne saath iftaar karaya?", options: ["Yes", "No"], audio: "audio/14.mp3" },
  { q: "Maine Allah ke raaste mein sadqa kiya?", options: ["Yes", "No"], audio: "audio/15.mp3" },
  { q: "Juma ke din Surah Kahaf ki tilaawat ki?", options: ["Yes", "No"], audio: "audio/16.mp3" },
  { q: "Maine Salatut tasbeeh ada ki?", options: ["Yes", "No"], audio: "audio/17.mp3" },
  { q: "Isaale sawab kiya aur apni maut ko yaad kiya?", options: ["Yes", "No"], audio: "audio/18.mp3" }
];

// ====================== STATE ======================

const answers = Array(QUESTIONS.length).fill(null);
let userName = '';
let currentAudio = null;

// ====================== AUDIO ======================

function playAudio(audioPath) {

  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
  }

  if (!audioPath) return;

  currentAudio = new Audio(audioPath);
  currentAudio.preload = "auto";

  currentAudio.onerror = (e) => {
    console.error("Audio error:", e);
  };

  currentAudio.play().catch(err => {
    console.error("Audio playback blocked:", err);
  });
}

// iOS audio unlock
document.addEventListener("touchstart", () => {
  const unlock = new Audio();
  unlock.src =
    "data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQIAAAAAAAA=";
  unlock.play().catch(() => {});
}, { once: true });

// ====================== QUESTION UI ======================

function createQuestionCard(index, data) {
  const card = document.createElement('div');
  card.className = 'card';
  card.setAttribute('data-index', index);

  const playRow = document.createElement('div');
  playRow.className = 'play-row';

  const playBtn = document.createElement('button');
  playBtn.className = 'play-btn';
  playBtn.setAttribute('aria-label', `Play question ${index + 1}`);
  playBtn.innerText = '🔊';

  playBtn.addEventListener('click', (e) => {
    e.preventDefault();
    playAudio(data.audio);
  });

  const qText = document.createElement('p');
  qText.className = 'question-text';
  qText.innerText = data.q;

  playRow.appendChild(playBtn);
  playRow.appendChild(qText);

  const opts = document.createElement('div');
  opts.className = 'options';

  data.options.forEach((optText, optIndex) => {
    const optBtn = document.createElement('button');
    optBtn.className = 'option-btn';

    if (data.options.length === 1) optBtn.classList.add('full');

    optBtn.setAttribute('data-q', index);
    optBtn.setAttribute('data-opt', optIndex);
    optBtn.setAttribute('aria-pressed', 'false');

    optBtn.innerText = optText;
    optBtn.addEventListener('click', () => selectOption(index, optIndex));

    opts.appendChild(optBtn);
  });

  card.appendChild(playRow);
  card.appendChild(opts);

  return card;
}

function renderAllQuestions() {
  const container = document.getElementById('questions');
  container.innerHTML = '';
  QUESTIONS.forEach((q, i) => {
    container.appendChild(createQuestionCard(i, q));
  });
}

// ====================== ANSWER SELECTION ======================

function selectOption(qIndex, optIndex) {
  const container = document.querySelector(`.card[data-index='${qIndex}']`);
  if (!container) return;

  const optionBtns = container.querySelectorAll('.option-btn');

  optionBtns.forEach(btn => {
    btn.classList.remove('selected');
    btn.setAttribute('aria-pressed', 'false');
  });

  const chosenBtn = container.querySelector(`.option-btn[data-opt='${optIndex}']`);

  if (chosenBtn) {
    chosenBtn.classList.add('selected');
    chosenBtn.setAttribute('aria-pressed', 'true');
  }

  answers[qIndex] = QUESTIONS[qIndex].options[optIndex];
}

// ====================== APP FLOW ======================

function greetOnEntry() {}
function farewellOnExit() {}

function handleNameSubmit() {

  const nameInput = document.getElementById('nameInput');
  const name = nameInput.value.trim();

  if (!name) {
    nameInput.focus();
    return;
  }

  userName = name;

  document.getElementById('welcome').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('userGreeting').innerText = `Welcome, ${userName}!`;

  renderAllQuestions();
}

function onSubmit() {

  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
  }

  const summaryList = document.getElementById('summaryList');
  summaryList.innerHTML = '';

  QUESTIONS.forEach((q, i) => {

    const item = document.createElement('div');
    item.className = 'summary-item';

    const qEl = document.createElement('div');
    qEl.className = 'q';
    qEl.innerText = q.q;

    const aEl = document.createElement('div');
    aEl.className = 'a';
    aEl.innerText = answers[i] || '—';

    item.appendChild(qEl);
    item.appendChild(aEl);
    summaryList.appendChild(item);
  });

  document.getElementById('summary').classList.remove('hidden');
  document.getElementById('editBtn').focus();
}

function closeSummary() {
  document.getElementById('summary').classList.add('hidden');
}

// ====================== INIT ======================

document.addEventListener('DOMContentLoaded', () => {

  const nameInput = document.getElementById('nameInput');
  const nameSubmitBtn = document.getElementById('nameSubmitBtn');

  nameSubmitBtn.addEventListener('click', handleNameSubmit);

  nameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleNameSubmit();
  });

  nameInput.focus();

  document.getElementById('submitBtn').addEventListener('click', onSubmit);
  document.getElementById('editBtn').addEventListener('click', closeSummary);

  document.getElementById('confirmBtn').addEventListener('click', async () => {

    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }

    farewellOnExit();

    const confirmBtn = document.getElementById('confirmBtn');
    confirmBtn.innerText = 'Saving...';
    confirmBtn.disabled = true;

    // Calculate score (count of "Yes") and percentage
    const totalQuestions = QUESTIONS.length;
    const score = answers.reduce((acc, a) => acc + (a === 'Yes' ? 1 : 0), 0);
    const percentage = totalQuestions ? Math.round((score / totalQuestions) * 100) : 0;

    const payload = {
      name: userName,
      answers,
      score,
      totalQuestions,
      percentage,
      timestamp: new Date().toISOString()
    };

    try {
      // MongoDB backend API endpoint
      const API_URL = '/api/responses';

      console.log('Sending to:', API_URL, payload);

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Data sent successfully:', result);
      confirmBtn.innerText = 'Saved';
    } catch (err) {
      console.error('Submit error:', err);
      confirmBtn.innerText = 'Save Failed';
      confirmBtn.disabled = false;
      alert('Error: ' + err.message);
      return;
    }

    setTimeout(closeSummary, 1600);
  });

});
