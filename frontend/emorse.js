const textfield = document.getElementById("textfield");
const morsebutton = document.getElementById("morsebutton");
const stopbutton = document.getElementById("stopbutton");
const morse_map = new Map();
const aud_context = new AudioContext();
const dot_duration = 50;
const line_duration = dot_duration * 3;
const word_silence_duration = dot_duration * 7;
const new_note_window = 5;
stopbutton.hidden = true;
stop = true;
let loop = true;

const delay = ms => new Promise(res => setTimeout(res, ms));

//MODEL
let humanizer_intensity = 0.1
let current_note_shift = 0;
let current_note_index = 0;
let current_scale = null;
let current_effects = null;

// array containing all the morse codes for every alphabet letter
const morse_code = [
  ".-", "-...", "-.-.", "-..", ".", "..-.", "--.", "....", "..",
  ".---", "-.-", ".-..", "--", "-.", "---", ".--.", "--.-", ".-.",
  "...", "-", "..-", "...-", ".--", "-..-", "-.--", "--.."
];

// array for numbers
const morse_numbers = [
  "-----", ".----", "..---", "...--", "....-", ".....", "-....", "--...", "---..", "----."
];

// array for special characters
const morse_special_chars = {
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
  const morseCode = morse_code[i - 97]; // gets morse code from the array
  morse_map.set(letter, morseCode); // adds letter and morse code to the map
}

// adds numbers to the map
for (let i = 0; i <= 9; i++) {
  morse_map.set(i.toString(), morse_numbers[i]);
}

// adds special characters to the map
Object.entries(morse_special_chars).forEach(([key, value]) => { morse_map.set(key, value); })

// map relating scales (expressed as semitones distances from the root) and emotions.
const eModes = {
  "wonder": [-12, -10, -8, -6, -5, -3, -1, 0, 2, 4, 6, 7, 9, 11, 12], // lydian
  "joy": [-12, -10, -8, -7, -5, -3, -1, 0, 2, 4, 5, 7, 9, 11, 12], // ionian
  "tenderness": [-12, -10, -8, -7, -5, -3, -2, 0, 2, 4, 5, 7, 9, 10, 12], // mixolydian
  "mystery": [-12, -10, -8, -7, -5, -4, -2, 0, 2, 4, 5, 7, 8, 10, 12], // mixolydian flat 6
  "nostalgia/longing": [-12, -10, -9, -7, -5, -3, -2, 0, 2, 3, 5, 7, 9, 10, 12],  // dorian
  "sadness": [-12, -10, -9, -7, -5, -4, -2, 0, 2, 3, 5, 7, 8, 10, 12], // aeolian
  "unease": [-12, -11, -9, -7, -5, -4, -2, 0, 1, 3, 5, 7, 8, 10, 12], // phrygian
  "tension": [-12, -11, -9, -7, -6, -4, -2, 0, 1, 3, 5, 6, 8, 10, 12], // locrian
  "non-sense": [-12, -11, -10, -9, -8, -7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], //chromatic
  "hilarity/goofiness": [], // goofy sounds
  "disgust": [], // disgustive sounds
  "neutral": [] // normal morse
}

const emo_ffects = {
  "wonder": [
    //new Tone.Reverb({ decay: 3, wet: 0.4 }),
    //new Tone.Chebyshev(14).toDestination()
  ],
  "joy": [],
  "tenderness": [],
  "mystery": [],
  "nostalgia/longing": [],
  "sadness": [],
  "unease": [],
  "tension": [],
  "non-sense": [],
  "hilarity/goofiness": [],
  "disgust": [],
  "neutral": []
}

const emotion_scale_chords = {
  "wonder": [0, 4, 6, 7, 11], // lydian
  "joy": [0, 4, 7, 11], // ionian
  "tenderness": [0, 5, 7, 10], // mixolydian
  "mystery": [], // mixolydian flat 6
  "nostalgia/longing": [0, 3, 7, 10], // dorian
  "sadness": [0, 3, 7], // aeolian
  "unease": [0, 1, 5, 7, 10], // phrygian
  "tension": [0, 3, 6, 10], // locrian
  "non-sense": [0, 6], //chromatic
  "hilarity/goofiness": [], // goofy sounds
  "disgust": [], // disgustive sounds
  "neutral": [] // normal morse
}

// the 4th octave's notes frequencies
const key_roots = [311.12, 329.63, 349.23, 369.99, 392, 415.30, 440, 466.16, 493.88, 523.25, 554.36, 587.32]; 

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

// generic sound playing function
function playTimedSound(duration, frequency, effects) {
  return new Promise((resolve) => {
    const osc = new Tone.Oscillator(frequency, "sine")
    osc.volume.value = -8;

    let previousEffect = osc;
    effects.forEach((effect) => {
        // connects subsequently the effects
        previousEffect.connect(effect);
        previousEffect = effect;
    });

    // connects the last effect to the destination
    previousEffect.toDestination()
    osc.start();
    setTimeout(() => {
      osc.stop();
      resolve();
    }, duration);
  });
}

// plays a dot sound
function playDot(key, scale, velocity, effects) {
  current_note_index = getRandomNoteInWindow(scale, current_note_index);
  let frequency = key * Math.pow(2, current_scale[current_note_index]/12);
  const duration = humanizeDuration(dot_duration/velocity, humanizer_intensity);
  return playTimedSound(duration, frequency, effects);
}

// plays a line sound
function playLine(key, scale, velocity, effects) {
  current_note_index = getRandomNoteInWindow(scale, current_note_index);
  let frequency = key * Math.pow(2, current_scale[current_note_index]/12);
  const duration = humanizeDuration(line_duration/velocity, humanizer_intensity);
  return playTimedSound(duration, frequency, effects);
}

// plays bass sound(s)
function playBass(key){
  let osc = new Tone.Oscillator(key/4, "sine")
  osc.volume.value = -10;
  osc.toDestination().start();
  return osc;
}

function playChord(key, chordSemitones){
  let polySynth = new Tone.PolySynth(Tone.Synth).toDestination();

  // synth parameters
  // TODO: maybe getting those dynamically?
  polySynth.set({
    oscillator: { type: "sine" },
    envelope: {
      attack: 0.5,
      decay: 0.2,
      sustain: 0.8,
      release: 1
    }
  });

  const chord = chordSemitones.map(semitone => 
    Tone.Frequency(key/2 * Math.pow(2, semitone/12)).toNote()
  );

  polySynth.volume.value = -15;
  polySynth.triggerAttack(chord);

  return polySynth;
}

// play a specified ambience sample sound
function playAmbience(ambience){
  let amb =  new Tone.Player({url: "../resources/sounds/" + ambience + ".mp3", fadeIn: 2, fadeOut: 2}).toDestination();
  amb.volume.value = -10;
  if(ambience == "rain"){
    amb.volume.value = -18;
  }
  amb.loop = true;
  // play as soon as the buffer is loaded
  amb.autostart = true;
  return amb;
}

// function used for handling non-morse coded characters
function playDaHeckAreYouWriting() {
  //TODO: qualche sburrata incredibile per i caratteri che non sono inclusi codice morse.
  changeKey();
}

/* core function of the application: loops on the characters contained in the text box and, 
   according to morse code and emotion detection, plays them in a "musical" way. */
async function morsify(input_string, emotion, velocity, ambience) {
  let current_key = key_roots[Math.floor(Math.random() * key_roots.length)];
  current_scale = eModes[emotion];
  current_note_index = Math.floor(current_scale.length/2);
  current_effects = emo_ffects[emotion];
  let ambPlayer = null;
  let bassOsc = null;
  let chordSynth = null;
  input_string = input_string.toLowerCase(); // converts the input to lower case

  if(ambience != "none"){
    ambPlayer = playAmbience(ambience);
  }

  if(input_string.length != 0){
    bassOsc = playBass(current_key); 
    chordSynth = playChord(current_key, emotion_scale_chords[emotion]);
    //Consider applying a cutoff sort of filter in order to lower the gain and reduce the possibility of cracks :/
  }

  for (let i = 0; loop && !stop; i++) {
    const current_char = input_string[i % input_string.length];

    if (stop == true) {
      if (ambPlayer) ambPlayer.stop();
      if (bassOsc) bassOsc.stop();
      if (chordSynth) chordSynth.releaseAll();
      break; // exits the cycle
    }

    if(!morse_map.has(current_char) && current_char != ' '){
      // the character is not morse-coded
      // changes key
      current_key = key_roots[Math.floor(Math.random() * key_roots.length)];
      if (bassOsc) bassOsc.stop();
      if (chordSynth) chordSynth.releaseAll();
      bassOsc = playBass(current_key);
      chordSynth = playChord(current_key, emotion_scale_chords[emotion]);

      //playDaHeckAreYouWriting();

      continue;
    }

    if (current_char === " ") {
      // space character: waits for a longer time interval (representing the end of a word)
      await delay(word_silence_duration/velocity);
      continue; // goes to next input character
    }

    const morseCode = morse_map.get(current_char);
    if (morseCode) {
      // reproduces every Morse symbol for the current character
      for (let j = 0; j < morseCode.length; j++) {
        if (morseCode[j] === ".") {
          await playDot(current_key, current_scale, velocity, current_effects);
          //current_note_index = shiftPivot(current_scale.length, current_note_index, current_note_shift);
          console.log(current_scale[current_note_index]);
        } else if (morseCode[j] === "-") {
          await playLine(current_key, current_scale, velocity, current_effects);
          //current_note_index = shiftPivot(current_scale.length, current_note_index, current_note_shift);
          console.log(current_scale[current_note_index]);
        }
        // waits for a little interval between the morse code symbols (ex. "." o "-")
        await delay(humanizeDuration(dot_duration/velocity, humanizer_intensity));
      }
      // waits for a "medium" time interval between in-word intervals
      await delay(humanizeDuration(line_duration/velocity, humanizer_intensity));
    }
  }

  if(!loop){
    stop = true;
  }

  if (ambPlayer) ambPlayer.stop();
  if (bassOsc) bassOsc.stop();
  if (chordSynth) chordSynth.releaseAll();

}

//CONTROLLER

function getRandomNoteInWindow(scale, pivot_index) {
  // computes the limits of the window
  const half_window = Math.floor(new_note_window / 2);
  const min_index = Math.max(0, pivot_index - half_window);
  const max_index = Math.min(scale.length - 1, pivot_index + half_window);

  // randomly selects the new note index
  const random_index = Math.floor(Math.random() * (max_index - min_index + 1)) + min_index;
  return random_index;
}

// randomly humanizes the duration of the sounds with a given intensity
function humanizeDuration(duration, humanizer_intensity){
  const variation = (Math.random() * 2 - 1) * humanizer_intensity * duration;
  return variation + duration;
}

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
  
  morsify(textfield.value, "tension", 0.8, "rain");
  morsebutton.hidden = true;
  stopbutton.hidden = false;
}

stopbutton.onclick = function () {
  stop = true;
  morsebutton.hidden = false;
  stopbutton.hidden = true;
}