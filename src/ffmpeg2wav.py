# Use ffmpeg to convert file to WAV @ 16k

def normalize_file(file):
    filename = str(uuid.uuid4()) + ".wav"
    fileLocation = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    stream = ffmpeg.input(file)
    stream = ffmpeg.output(stream, fileLocation, acodec='pcm_s16le', ac=1, ar='16k')
    ffmpeg.run(stream)
    return filename