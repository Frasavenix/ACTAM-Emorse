const textfield = document.getElementById("textfield");
const morsebutton = document.getElementById("morsebutton");
const morseMap = new Map();
const aud_context = new AudioContext();
const dot_duration = 0.05;
const line_duration = dot_duration * 3;
const word_silence_duration = dot_duration * 7;

const delay = ms => new Promise(res => setTimeout(res, ms));

// Array che contiene il codice Morse per ogni lettera dell'alfabeto in ordine
const morseCodes = [
    ".-", "-...", "-.-.", "-..", ".", "..-.", "--.", "....", "..", 
    ".---", "-.-", ".-..", "--", "-.", "---", ".--.", "--.-", ".-.", 
    "...", "-", "..-", "...-", ".--", "-..-", "-.--", "--.."
];

// Array per numeri da 0 a 9
const morseNumbers = [
    "-----", ".----", "..---", "...--", "....-", ".....", "-....", "--...", "---..", "----."
];

// Array per simboli speciali comuni
const morseSpecialChars = {
    ".": ".-.-.-", 
    ",": "--..--", 
    "?": "..--..", 
    "!": "-.-.--", 
    "/": "-..-.", 
    "(": "-.--.", 
    ")": "-.--.-", 
    "&": ".-...", 
    ":": "---...", 
    ";": "-.-.-.", 
    "=": "-...-", 
    "+": ".-.-.", 
    "-": "-....-", 
    "_": "..--.-", 
    "\"": ".-..-.", 
    "@": ".--.-."
};

// Ciclo per aggiungere le lettere dalla 'a' alla 'z' con il corrispondente codice Morse
for (let i = 97; i <= 122; i++) {
    letter = String.fromCharCode(i); // Converte il codice ASCII in lettera
    morseCode = morseCodes[i - 97]; // Ottiene il codice Morse dall'array
    morseMap.set(letter, morseCode); // Aggiunge la lettera e il codice Morse alla mappa
}

// Ciclo per aggiungere i numeri da '0' a '9'
for (let i = 0; i <= 9; i++) {
    morseMap.set(i.toString(), morseNumbers[i]); // Aggiunge i numeri alla mappa
}

// Aggiungere i simboli speciali alla mappa
Object.entries(morseSpecialChars).forEach(([key, value]) => {morseMap.set(key, value);})

function playSound(duration) {
  return new Promise((resolve) => {
    const osc = aud_context.createOscillator();
    const gain = aud_context.createGain();
    osc.frequency.value = 580;
    osc.connect(gain);
    gain.connect(aud_context.destination);
    osc.start();

    gain.gain.setValueAtTime(1, aud_context.currentTime); // Inizia con gain a 1
    gain.gain.setValueAtTime(0, aud_context.currentTime + duration); // Finisce con gain a 0

    osc.stop(aud_context.currentTime + duration); // Ferma l'oscillatore dopo la durata
    osc.onended = resolve; // Risolve la Promise una volta terminato il suono
  });
}

function playDot() {
  return playSound(dot_duration);
}

function playLine() {
  return playSound(line_duration);
}

function playDaHeckAreYouWriting(){
  //TODO: qualche sburrata incredibile per i caratteri che non sono inclusi codice morse.
}

async function morsify(input_string) {
  input_string = input_string.toLowerCase(); // Converte l'input a minuscolo
  
  for (let i = 0; i < input_string.length; i++) {
    const current_char = input_string[i];

    if (current_char === " ") {
      // Spazio: intervallo più lungo per segnalare la fine della parola
      await delay(word_silence_duration * 1000);
      continue; // Passa al prossimo carattere
    }

    const morseCode = morseMap.get(current_char);
    if (morseCode) {
      // Riproduce ogni simbolo Morse per il carattere attuale
      for (let j = 0; j < morseCode.length; j++) {
        if (morseCode[j] === ".") {
          await playDot();
        } else if (morseCode[j] === "-") {
          await playLine();
        }
        // Attende un piccolo intervallo tra i simboli nel codice Morse (es. "." o "-")
        await delay(dot_duration * 1000);
      }
      // Attende un intervallo medio tra i caratteri nella parola
      await delay(line_duration * 1000);
    } else {
      // Carattere non supportato
      playDaHeckAreYouWriting();
    }
  }
}

morsebutton.onclick = function() {
  morsify(textfield.value);
}