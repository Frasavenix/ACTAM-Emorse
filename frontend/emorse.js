const textfield = document.getElementById("textfield");
const morsebutton = document.getElementById("morsebutton");
const morseMap = new Map();
const aud_context = new AudioContext();
const dot_duration = 50;
const line_duration = dot_duration * 3;
const word_silence_duration = dot_duration * 7;

stop = true;
const loop = false;

const delay = ms => new Promise(res => setTimeout(res, ms));

//MODEL

// array containing all the morse codes for every alphabet letter
const morseCodes = [
  ".-", "-...", "-.-.", "-..", ".", "..-.", "--.", "....", "..",
  ".---", "-.-", ".-..", "--", "-.", "---", ".--.", "--.-", ".-.",
  "...", "-", "..-", "...-", ".--", "-..-", "-.--", "--.."
];

// array for numbers
const morseNumbers = [
  "-----", ".----", "..---", "...--", "....-", ".....", "-....", "--...", "---..", "----."
];

// array for special characters
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

// adds all alphabet characters to the map
for (let i = 97; i <= 122; i++) {
  const letter = String.fromCharCode(i); // converts ASCII to a letter
  const morseCode = morseCodes[i - 97]; // gets morse code from the array
  morseMap.set(letter, morseCode); // adds letter and morse code to the map
}

// adds numbers to the map
for (let i = 0; i <= 9; i++) {
  morseMap.set(i.toString(), morseNumbers[i]);
}

// adds special characters to the map
Object.entries(morseSpecialChars).forEach(([key, value]) => { morseMap.set(key, value); })

// map relating scales (expressed as semitones distances from the root) and emotions.
const eModes = {
  "wonder": ["-10", "-8", "-6", "-5", "-3", "-1", "0", "2", "4", "6", "7", "9", "11"], // lydian
  "joy": ["-10", "-8", "-7", "-5", "-3", "-1", "0", "2", "4", "5", "7", "9", "11"], // ionian
  "tenderness": ["-10", "-8", "-7", "-5", "-3", "-2", "0", "2", "4", "5", "7", "9", "10"], // mixolydian
  "mystery": ["-10", "-8", "-7", "-5", "-4", "-2", "0", "2", "4", "5", "7", "8", "10"], // mixolydian flat 6
  "nostalgia/longing": ["-10", "-9", "-7", "-5", "-3", "-2", "0", "2", "3", "5", "7", "9", "10"],  // dorian
  "sadness": ["-10", "-9", "-7", "-5", "-4", "-2", "0", "2", "3", "5", "7", "8", "10"], // eolian
  "unease": ["-11", "-9", "-7", "-5", "-4", "-2", "0", "1", "3", "5", "7", "8", "10"], // phrygian
  "tension": ["-11", "-9", "-7", "-6", "-4", "-2", "0", "1", "3", "5", "6", "8", "10"], // locrian
  "non-sense": ["-11", "-10", "-9", "-8", "-7", "-6", "-5", "-4", "-3", "-2", "-1", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"], //chromatic
  "hilarity/goofiness": [], // goofy sounds
  "disgust": [], // disgustive sounds
  "neutral": [] // normal morse
}

// the 4th octave's notes frequencies
const key_roots = [261.63, 277.18, 293.66, 311.13, 329.63, 349.23, 369.99, 392, 415.30, 440, 466.16, 493.88]; 

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

function playSound(duration, frequency) {
  return new Promise((resolve) => {
    const osc = new Tone.Oscillator(frequency, "sine").toDestination().start();
    setTimeout(() => {
      osc.stop();
    }, duration);
    osc.onstop = resolve;
  });
}

function playDot(key, scale, velocity) {
  const frequency = key * Math.pow(2, scale[Math.floor(Math.random() * scale.length)]/12);
  return playSound(dot_duration/velocity, frequency);
}

function playLine(key, scale, velocity) {
  const frequency = key * Math.pow(2, scale[Math.floor(Math.random() * scale.length)]/12);
  return playSound(line_duration/velocity, key, scale);
}

function playBass(key){
  const osc = new Tone.Oscillator(key/4, "sine").toDestination().start();
}

function playDaHeckAreYouWriting() {
  //TODO: qualche sburrata incredibile per i caratteri che non sono inclusi codice morse.
}

async function morsify(input_string, emotion, velocity) {
  let current_key = key_roots[Math.floor(Math.random() * key_roots.length)];
  let current_scale = eModes[emotion];
  input_string = input_string.toLowerCase(); // converts the input to lower case

  playBass(current_key);

  for (let i = 0; loop || i < input_string.length; i++) {
    const current_char = input_string[i % input_string.length];

    if (stop == true) {
      break; // exits the cycle
    }

    if (current_char === " ") {
      // space character: waits for a longer time interval (representing the end of a word)
      await delay(word_silence_duration/velocity);
      continue; // goes to next input character
    }

    const morseCode = morseMap.get(current_char);
    if (morseCode) {
      // reproduces every Morse symbol for the current character
      for (let j = 0; j < morseCode.length; j++) {
        if (morseCode[j] === ".") {
          await playDot(current_key, current_scale, velocity);
        } else if (morseCode[j] === "-") {
          await playLine(current_key, current_scale, velocity);
        }
        // waits for a little interval between the morse code symbols (ex. "." o "-")
        await delay(dot_duration/velocity);
      }
      // waits for a "medium" time interval between in-word intervals
      await delay(line_duration/velocity);
    } else {
      // the character is not morse coded
      playDaHeckAreYouWriting();
    }
  }
}

//CONTROLLER

morsebutton.onclick = async function () {
  stop = false;

  /*detectEmotion(textfield.value).then((emotions) => {
    console.log("detected emotions:", emotions);
  });*/

  //extract emotion
  /*if(emotion == "non-sense"){
    morsify(textfield.value, "non-sense", 2);
    await delay(300);
    morsify(textfield.value, "non-sense", 2);
  }*/
  
  morsify(textfield.value, "non-sense", 2);
}

stopbutton.onclick = function () {
  stop = true;
}

loopbutton.onclick = function () {
  loop = !loop;

}