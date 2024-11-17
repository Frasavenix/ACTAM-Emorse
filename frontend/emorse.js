const textfield = document.getElementById("textfield");
const morsebutton = document.getElementById("morsebutton");
const morseMap = new Map();
const aud_context = new AudioContext();
const dot_duration = 0.05;
const line_duration = dot_duration * 3;
const word_silence_duration = dot_duration * 7;

stop = true;
const loop = false;

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
  const letter = String.fromCharCode(i); // Converte il codice ASCII in lettera
  const morseCode = morseCodes[i - 97]; // Ottiene il codice Morse dall'array
  morseMap.set(letter, morseCode); // Aggiunge la lettera e il codice Morse alla mappa
}

// Ciclo per aggiungere i numeri da '0' a '9'
for (let i = 0; i <= 9; i++) {
  morseMap.set(i.toString(), morseNumbers[i]); // Aggiunge i numeri alla mappa
}

// Aggiungere i simboli speciali alla mappa
Object.entries(morseSpecialChars).forEach(([key, value]) => { morseMap.set(key, value); })

//MODEL

async function detectEmotion(prompt) {
  return fetch("http://localhost:3000", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message: prompt
    })
  });
}

//VIEW

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

function playDaHeckAreYouWriting() {
  //TODO: qualche sburrata incredibile per i caratteri che non sono inclusi codice morse.
}

async function morsify(input_string) {
  input_string = input_string.toLowerCase(); // Converte l'input a minuscolo

  for (let i = 0; loop || i < input_string.length; i++) {
    const current_char = input_string[i % input_string.length];

    if (stop == true) {
        break; // Esce dal ciclo
    }

    if (current_char === " ") {
      // Spazio: intervallo più lungo per segnalare la fine della parola
      await delay(word_silence_duration * 1000);
      continue; //Passa al prossimo carattere
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

//CONTROLLER

/*
detectEmotion("You are an emotionally-intelligent and empathetic agent. You will be given a piece of text, and your task is to identify all the emotions expressed by the writer of the text."
   + "You are only allowed to make selections from the following emotions, and don’t use any other words: "
   + "[Joy, Sadness, Anger, Anxiety, Chill, Disgust]. Only select those ones for which you are reasonably confident that they are expressed"
   + "in the text. If no emotion is clearly expressed, select ‘neutral’. Reply with only the list of emotions, separated by comma.");
*/
morsebutton.onclick = function () {
  stop = false;

  detectEmotion(textfield.value).then((emotions) => {
    console.log("detected emotions:", emotions);
  });

  morsify(textfield.value);
}

stopbutton.onclick = function () {
  stop = true;
}

loopbutton.onclick = function () {
  loop = !loop;
  
}