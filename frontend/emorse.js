const textfield = document.getElementById("textfield");
const morsebutton = document.getElementById("morsebutton");
const stopbutton = document.getElementById("stopbutton");
const morse_map = new Map();
const aud_context = new AudioContext();
const dot_duration = 50;
const line_duration = dot_duration * 3;
const word_silence_duration = dot_duration * 6;
const new_note_window = 5;
stopbutton.hidden = true;
stop = true;
let loop = true;

//MODEL
let humanizer_intensity = 0.1
let current_note_shift = 0;
let current_note_index = 0;
let current_scale = null;
let current_effects = null;
let oscSynth = null;
let lowpass = null;
let compressor = null;

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
  "mystery": [0, 4, 7, 8, 10], // mixolydian flat 6
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

// function used to wait some specified time
function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => resolve(), ms);

    if (signal) {
      signal.addEventListener("abort", () => {
        clearTimeout(timeout);
        reject(new Error("playback stopped."));
      });
    }
  });
}

// generic sound playing function
function playTimedSound(duration, frequency, effects, signal) {
  return new Promise((resolve, reject) => {
    if(!oscSynth || oscSynth.disposed){
      oscSynth = new Tone.Synth({
        oscillator: {
          type: "sine", // Forma d'onda sinusoidale
        },
        envelope: {
          attack: duration / 1000 / 100,              // fade-in
          sustain: 1 - 2 * (duration / 1000 / 100),   // full note time
          release: duration / 1000 / 100,             // fade-out
        },
      });

      let last_effect = oscSynth;
      effects.forEach((effect) => {
        last_effect.connect(effect);
        last_effect = effect;
      });
  
      lowpass = new Tone.Filter({
        frequency: 8000,  // Frequenza di taglio
        type: "lowpass",  // Tipo di filtro
        rolloff: -12,     // Pendenza in dB per ottava
      });
      
      last_effect.connect(lowpass);
      last_effect = lowpass;
  
      compressor = new Tone.Compressor({
        threshold: -9,  // Livello a cui inizia la compressione
        ratio: 3,       // Rapporto di compressione
        attack: 0.01,   // Tempo per iniziare la compressione
        release: 0.1,   // Tempo per rilasciare la compressione
      });
      
      last_effect.connect(compressor);
      last_effect = compressor;
      
      
      // connects the last effect to the destination
      last_effect.toDestination();
      oscSynth.volume.value = -10;

    }else{
      oscSynth.attack = duration / 1000 / 50;
      oscSynth.release = duration / 1000 / 50;
      oscSynth.sustain = 1 - 2 * (duration / 1000 / 100);
    }

    // connects the last effect to the destination
    //previousEffect.toDestination()

    oscSynth.triggerAttackRelease(frequency, duration / 1000);

    const timeout = setTimeout(() => {
      if (!signal.aborted) resolve();
    }, duration);

    signal.addEventListener("abort", () => {
      oscSynth.triggerRelease();
      clearTimeout(timeout);
      reject(new Error("playback stopped."));
    });  
  });
}

// plays a dot sound
function playDot(key, scale, velocity, effects, signal) {
  current_note_index = getRandomNoteInWindow(scale, current_note_index);
  let frequency = key * Math.pow(2, current_scale[current_note_index]/12);
  const duration = humanizeDuration(dot_duration/velocity, humanizer_intensity);
  return playTimedSound(duration, frequency, effects, signal);
}

// plays a line sound
function playLine(key, scale, velocity, effects, signal) {
  current_note_index = getRandomNoteInWindow(scale, current_note_index);
  let frequency = key * Math.pow(2, current_scale[current_note_index]/12);
  const duration = humanizeDuration(line_duration/velocity, humanizer_intensity);
  return playTimedSound(duration, frequency, effects, signal);
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

  /*
  lowpass = new Tone.Filter({
    frequency: 8000,  // Frequenza di taglio
    type: "lowpass",  // Tipo di filtro
    rolloff: -12,     // Pendenza in dB per ottava
  });
  
  polySynth.connect(lowpass);
  polySynth = lowpass;

  compressor = new Tone.Compressor({
    threshold: -9,  // Livello a cui inizia la compressione
    ratio: 3,       // Rapporto di compressione
    attack: 0.01,   // Tempo per iniziare la compressione
    release: 0.1,   // Tempo per rilasciare la compressione
  });
  
  polySynth.connect(compressor);
  polySynth = compressor; */

  polySynth.volume.value = -15;
  polySynth.triggerAttack(chord);

  return polySynth;
}

// play a specified ambience sample sound
function playAmbience(ambience){
  let amb =  new Tone.Player({url: "../resources/sounds/" + ambience + ".mp3", fadeIn: 2, fadeOut: 2});
  const analyser = new Tone.DCMeter({ channels: 1 }); // a metering node
  amb.connect(analyser).toDestination();
  amb.volume.value = -12; 

  const interval = setInterval(() => {
    const level = analyser.getValue(); // get the current level
    const adjustment = -12 - level;
    amb.volume.value += adjustment * 0.1; // adjust dynamically

    if (amb.state === "stopped") clearInterval(interval); // stop if player stops
  }, 100); // adjust every 100ms

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

let abort_controller = null;

// aborting/stopping function
function stopPlayback() {
  if (abort_controller) {
    abort_controller.abort(); // abort ongoing operations immediately
    abort_controller = null; // reset for future use
  }
}

// debounced version of the stop playback function
const debouncedStopPlayback = debounce(stopPlayback, 300); // 50ms delay


/* core function of the application: loops on the characters contained in the text box and, 
   according to morse code and emotion detection, plays them in a "musical" way. */
async function morsify(input_string, emotion, velocity, ambience) {

  // creating an instance of abort controller, wich will be used in order to immediately stop the on-going playing sound (or delay).
  abort_controller = new AbortController();
  const { signal } = abort_controller;

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

  try{
    for (let i = 0; !signal.aborted; i++) {
      // stop check
      if (signal.aborted) throw new Error("playback stopped.");
      
      const current_char = input_string[i % input_string.length];

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
        await delay(humanizeDuration(word_silence_duration/velocity, humanizer_intensity), signal);
        continue; // goes to next input character
      }

      const morseCode = morse_map.get(current_char);
      if (morseCode) {
        // reproduces every Morse symbol for the current character
        for (let j = 0; j < morseCode.length; j++) {
          // stop check
          if (signal.aborted) throw new Error("playback stopped");

          if (morseCode[j] === ".") {
            await playDot(current_key, current_scale, velocity, current_effects, signal);
            //current_note_index = shiftPivot(current_scale.length, current_note_index, current_note_shift);
            console.log(current_scale[current_note_index]);
          } else if (morseCode[j] === "-") {
            await playLine(current_key, current_scale, velocity, current_effects, signal);
            //current_note_index = shiftPivot(current_scale.length, current_note_index, current_note_shift);
            console.log(current_scale[current_note_index]);
          }
          // waits for a little interval between the morse code symbols (ex. "." o "-")
          await delay(humanizeDuration(dot_duration/velocity, humanizer_intensity), signal);
        }
        // waits for a "medium" time interval between in-word intervals
        await delay(humanizeDuration(line_duration/velocity, humanizer_intensity), signal);
      }
    }
  }catch(error){
    console.error(error);
  }finally{
    // stops every remaining sound playing
    if (ambPlayer){
      ambPlayer.onstop = () => ambPlayer.dispose(); //clears the memory
      ambPlayer.stop();
    }
    if (bassOsc){
      bassOsc.onstop = () => bassOsc.dispose(); //clears the memory
      bassOsc.stop();
    }
    if (chordSynth) {
      chordSynth.onstop = () => chordSynth.dispose(); //clears the memory
      chordSynth.releaseAll();
    }

    // clears the memory currently in use
    oscSynth.dispose();
  }
}

//CONTROLLER

// generalized debounce function
function debounce(func, delay) {
  let timeoutId;
  return (...args) => {
    if (timeoutId) clearTimeout(timeoutId); // clear the previous timer
    timeoutId = setTimeout(() => func(...args), delay); // set a new timer
  };
}

// function that extracts a new random note form the specified window boundaries of the given scale
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

  morsebutton.hidden = true;
  stopbutton.hidden = false;
  await morsify(textfield.value, "mystery", 0.02, "none");
}

stopbutton.onclick = function () {
  stopPlayback();
  morsebutton.hidden = false;
  stopbutton.hidden = true;
}