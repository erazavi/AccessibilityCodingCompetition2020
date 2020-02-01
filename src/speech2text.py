#https://medium.com/datadriveninvestor/speech-to-text-app-in-your-browser-using-deep-learning-35889fbd50ed

import sys
!{sys.executable} -m pip install future
----------------------------------------
from __future__ import absolute_import, division, print_function

import os
import numpy as np
import shlex
import subprocess
import sys
import wave

!pip install deepspeech 
from deepspeech import Model, printVersions
from timeit import default_timer as timer

# audio converters
!apt update && apt-get install ffmpeg mpg123

# sox package for adjusting sample rate.
!apt-get install libsox-fmt-all libsox-dev sox

# neural network model for acoustic recognition
!wget -O - https://github.com/mozilla/DeepSpeech/releases/download/v0.3.0/deepspeech-0.3.0-models.tar.gz | tar xvfz -
    
    
model    = 'models/output_graph.pbmm'
alphabet = 'models/alphabet.txt'
lm       = 'models/lm.binary'
trie     = 'models/trie'

# These constants control the beam search decoder

# Beam width used in the CTC decoder when building candidate transcriptions
BEAM_WIDTH = 500

# The alpha hyperparameter of the CTC decoder. Language Model weight
LM_WEIGHT = 1.50

# Valid word insertion weight. This is used to lessen the word insertion penalty
# when the inserted word is part of the vocabulary
VALID_WORD_COUNT_WEIGHT = 2.10


# These constants are tied to the shape of the graph used (changing them changes
# the geometry of the first layer), so make sure you use the same constants that
# were used during training

# Number of MFCC features to use
N_FEATURES = 26

# Size of the context window used for producing timesteps in the input vector
N_CONTEXT = 9

def convert_samplerate(audio_path):
    sox_cmd = 'sox {} --type raw --bits 16 --channels 1 --rate 16000 --encoding signed-integer --endian little --compression 0.0 --no-dither - '.format(audio_path)
    try:
        output = subprocess.check_output(shlex.split(sox_cmd), stderr=subprocess.PIPE)
    except subprocess.CalledProcessError as e:
        raise RuntimeError('SoX returned non-zero status: {}'.format(e.stderr))
    except OSError as e:
        raise OSError(e.errno, 'SoX not found, use 16kHz files or install it: {}'.format(e.strerror))

    return 16000, np.frombuffer(output, np.int16)

# upload mp3 audio file.

from google.colab import files
uploaded = files.upload()
for audio in uploaded.keys():
  print('User uploaded file "{name}" with length {length} bytes'.format(
         name=audio, length=len(uploaded[audio])))

os.rename(audio, 'speech.mp3')
audio = 'speech.wav'

# convert to wav file.  
!ffmpeg -i speech.mp3 -vn -acodec pcm_s16le -ac 1 -ar 16000 -f wav speech.wav
#!mpg123 -w speech.wav speech.mp3

    print('Loading model from file {}'.format(model), file=sys.stderr)
    model_load_start = timer()
    ds = Model(model, N_FEATURES, N_CONTEXT, alphabet, BEAM_WIDTH)
    model_load_end = timer() - model_load_start
    print('Loaded model in {:.3}s.'.format(model_load_end), file=sys.stderr)

    if lm and trie:
        print('Loading language model from files {} {}'.format(lm, trie), file=sys.stderr)
        lm_load_start = timer()
        ds.enableDecoderWithLM(alphabet, lm, trie, LM_WEIGHT,
                               VALID_WORD_COUNT_WEIGHT)
        lm_load_end = timer() - lm_load_start
        print('Loaded language model in {:.3}s.'.format(lm_load_end), file=sys.stderr)

    fin = wave.open(audio, 'rb')
    fs = fin.getframerate()
    if fs != 16000:
        print('Warning: original sample rate ({}) is different than 16kHz. Resampling might produce erratic speech recognition.'.format(fs), file=sys.stderr)
        fs, audio = convert_samplerate(audio)
    else:
        audio = np.frombuffer(fin.readframes(fin.getnframes()), np.int16)

    audio_length = fin.getnframes() * (1/16000)
    fin.close()

    print('Running inference.', file=sys.stderr)
    print('================================\n')
    inference_start = timer()
    print(ds.stt(audio, fs))
    inference_end = timer() - inference_start
    print('\n================================')
    print('Inference took %0.3fs for %0.3fs audio file.' % (inference_end, audio_length), file=sys.stderr)