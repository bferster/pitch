window.AudioContext = window.AudioContext || window.webkitAudioContext;

var jj=0,kk=0;
var audioContext = null;
var isPlaying = false;
var sourceNode = null;
var analyser = null;
var theBuffer = null;
var DEBUGCANVAS = null;
var mediaStreamSource = null;
var detectorElem, 
	canvasElem,
	waveCanvas,
	pitchElem,
	noteElem,
	detuneElem,
	detuneAmount;

window.onload = function() {
	audioContext = new AudioContext();
	MAX_SIZE = Math.max(4,Math.floor(audioContext.sampleRate/5000));	// corresponds to a 5kHz signal
	detectorElem = document.getElementById( "detector" );
	canvasElem = document.getElementById( "output" );
	DEBUGCANVAS = document.getElementById( "waveform" );
	if (DEBUGCANVAS) {
		waveCanvas = DEBUGCANVAS.getContext("2d");
		waveCanvas.strokeStyle = "black";
		waveCanvas.lineWidth = 1;
		}
	pitchElem = document.getElementById( "pitch" );
}

function error() {
    alert('Stream generation failed.');
}

function getUserMedia(dictionary, callback) {
    try {
        navigator.getUserMedia = 
        	navigator.getUserMedia ||
        	navigator.webkitGetUserMedia ||
        	navigator.mozGetUserMedia;
        navigator.getUserMedia(dictionary, callback, error);
    } catch (e) {
        alert('getUserMedia threw exception :' + e);
    }
}

function gotStream(stream) {
    mediaStreamSource = audioContext.createMediaStreamSource(stream);
    analyser=audioContext.createAnalyser();
    analyser.fftSize = 2048;
    mediaStreamSource.connect( analyser );
    updatePitch();
}

function toggleLiveInput() {
    if (isPlaying) {
        //stop playing and return
        sourceNode.stop( 0 );
        sourceNode = null;
        analyser = null;
        isPlaying = false;
		if (!window.cancelAnimationFrame)
			window.cancelAnimationFrame = window.webkitCancelAnimationFrame;
        window.cancelAnimationFrame( rafID );
    }
    getUserMedia(
    	{
            "audio": {
                "mandatory": {
                    "googEchoCancellation": "false",
                    "googAutoGainControl": "false",
                    "googNoiseSuppression": "false",
                    "googHighpassFilter": "false"
                },
                "optional": []
            },
        }, gotStream);
}

function togglePlayback() {
    if (isPlaying) {
        //stop playing and return
        sourceNode.stop( 0 );
        sourceNode = null;
        analyser = null;
        isPlaying = false;
		if (!window.cancelAnimationFrame)
			window.cancelAnimationFrame = window.webkitCancelAnimationFrame;
        window.cancelAnimationFrame( rafID );
        return "start";
    }

    sourceNode = audioContext.createBufferSource();
    sourceNode.buffer = theBuffer;
    sourceNode.loop = true;

    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    sourceNode.connect( analyser );
    analyser.connect( audioContext.destination );
    sourceNode.start( 0 );
    isPlaying = true;
    isLiveInput = false;
    updatePitch();

    return "stop";
}

var rafID = null;
var tracks = null;
var buflen = 1024;
var buf = new Float32Array( buflen );
var tbuf = new Float32Array( buflen );

var MIN_SAMPLES = 0;  // will be initialized when AudioContext is created.
var GOOD_ENOUGH_CORRELATION = 0.9; // this is the "bar" for how close a correlation needs to be

function autoCorrelate( buf, sampleRate ) {
	var SIZE = buf.length;
	var MAX_SAMPLES = Math.floor(SIZE/2);
	var best_offset = -1;
	var best_correlation = 0;
	var rms = 0;
	var foundGoodCorrelation = false;
	var correlations = new Array(MAX_SAMPLES);

	for (var i=0;i<SIZE;i++) {
		var val = buf[i];
		rms += val*val;
	}
	rms = Math.sqrt(rms/SIZE);
	if (rms<0.01) // not enough signal
		return -1;

	var lastCorrelation=1;
	for (var offset = MIN_SAMPLES; offset < MAX_SAMPLES; offset++) {
		var correlation = 0;

		for (var i=0; i<MAX_SAMPLES; i++) {
			correlation += Math.abs((buf[i])-(buf[i+offset]));
		}
		correlation = 1 - (correlation/MAX_SAMPLES);
		correlations[offset] = correlation; // store it, for the tweaking we need to do below.
		if ((correlation>GOOD_ENOUGH_CORRELATION) && (correlation > lastCorrelation)) {
			foundGoodCorrelation = true;
			if (correlation > best_correlation) {
				best_correlation = correlation;
				best_offset = offset;
			}
		} else if (foundGoodCorrelation) {
			// short-circuit - we found a good correlation, then a bad one, so we'd just be seeing copies from here.
			// Now we need to tweak the offset - by interpolating between the values to the left and right of the
			// best offset, and shifting it a bit.  This is complex, and HACKY in this code (happy to take PRs!) -
			// we need to do a curve fit on correlations[] around best_offset in order to better determine precise
			// (anti-aliased) offset.

			// we know best_offset >=1, 
			// since foundGoodCorrelation cannot go to true until the second pass (offset=1), and 
			// we can't drop into this clause until the following pass (else if).
			var shift = (correlations[best_offset+1] - correlations[best_offset-1])/correlations[best_offset];  
			return sampleRate/(best_offset+(8*shift));
		}
		lastCorrelation = correlation;
	}
	if (best_correlation > 0.01) {
		// console.log("f = " + sampleRate/best_offset + "Hz (rms: " + rms + " confidence: " + best_correlation + ")")
		return sampleRate/best_offset;
	}
	return -1;
}

function updatePitch( time ) {
	var cycles = new Array;
	analyser.getFloatTimeDomainData( buf );
//	analyser.getFloatFrequencyData(tbuf);	

	var ac = autoCorrelate( buf, audioContext.sampleRate );
	waveCanvas.clearRect(0,0,512,256);
	waveCanvas.strokeStyle = "red";
	waveCanvas.beginPath();
	waveCanvas.moveTo(0,0);
	waveCanvas.lineTo(0,256);
	waveCanvas.moveTo(128,0);
	waveCanvas.lineTo(128,256);
	waveCanvas.moveTo(256,0);
	waveCanvas.lineTo(256,256);
	waveCanvas.moveTo(384,0);
	waveCanvas.lineTo(384,256);
	waveCanvas.moveTo(512,0);
	waveCanvas.lineTo(512,256);
	waveCanvas.stroke();
	waveCanvas.strokeStyle = "#777";
	waveCanvas.beginPath();
	waveCanvas.moveTo(0,buf[0]);
	for (var i=1;i<128;i++) {
		waveCanvas.lineTo(i*4,(tbuf[i])/4);
	}
	waveCanvas.stroke();

 	if (ac != -1) {
trace(kk)		
		
		pitch = ac;
		pitchElem.innerText = Math.round( pitch ) ;
if (pitch < 500) {
tbuf[(jj++)%128]=pitch
//console.log(pitch)
	}


}
else 
kk++

if (kk > 100)
kk=jj=0;

	if (!window.requestAnimationFrame)
		window.requestAnimationFrame = window.webkitRequestAnimationFrame;
	rafID = window.requestAnimationFrame( updatePitch );
}

////////////////////////////////////////////////////////////////////////////////////////////
// HELPERS
////////////////////////////////////////////////////////////////////////////////////////////

function trace(msg, p1, p2, p3, p4)										// CONSOLE 
{
	if (p4 != undefined)
		console.log(msg,p1,p2,p3,p4);
	else if (p3 != undefined)
		console.log(msg,p1,p2,p3);
	else if (p2 != undefined)
		console.log(msg,p1,p2);
	else if (p1 != undefined)
		console.log(msg,p1);
	else
		console.log(msg);
}