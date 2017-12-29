window.AudioContext = window.AudioContext || window.webkitAudioContext;

var jj=0,kk=0;
var audioContext = null;
var isPlaying = false;
var sourceNode = null;
var analyser = null;
var theBuffer = null;
var DEBUGCANVAS = null;
var mediaStreamSource = null;
var	waveCanvas, waveCanvas2, pitchElem;
var mp3file=null;

window.onload = function() {
	audioContext = new AudioContext();
	MAX_SIZE = Math.max(4,Math.floor(audioContext.sampleRate/5000));	// corresponds to a 5kHz signal
	var request = new XMLHttpRequest();
	request.open("GET", "hello.mp3", true);
	request.responseType = "arraybuffer";
	request.onload=function() {
		audioContext.decodeAudioData( request.response,function(buffer) { 
	   		theBuffer=buffer;
			});
		}
	request.send();

	waveCanvas = document.getElementById( "waveform" ).getContext("2d");
	waveCanvas2 = document.getElementById( "waveform2" ).getContext("2d");

		pitchElem = document.getElementById( "pitch" );
}

function error() {   alert("Doesn't work on this browser. Try Firefox"); }

////////////////////////////////////////////////////////////////////////////////////////////
// AUDIO SOURCE
////////////////////////////////////////////////////////////////////////////////////////////

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
	jj=0;
	for (i=0;i<512;++i)	tbuf[i]=0;
	rafID=setInterval(updatePitch,1)									// Start timer
}

function toggleLiveInput() {
        isPlaying=false;
		clearInterval(rafID);											// Clear timer

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

 	clearInterval(rafID);											
  	kk=jj=0;
	for (i=0;i<512;++i)	tbuf[i]=0;
	sourceNode=audioContext.createBufferSource();
    sourceNode.buffer=theBuffer;
    analyser=audioContext.createAnalyser();
    analyser.fftSize=2048;
    sourceNode.connect(analyser);
    analyser.connect(audioContext.destination);
    sourceNode.start(0);
 	rafID=setInterval(updatePitch2,1)									
 }

////////////////////////////////////////////////////////////////////////////////////////////
// FIND/SHOW PITCH
////////////////////////////////////////////////////////////////////////////////////////////

var rafID = null;
var buflen = 1024;
var buf = new Float32Array( buflen );
var tbuf = new Float32Array( buflen );

var MIN_SAMPLES = 0;  // will be initialized when AudioContext is created.
var GOOD_ENOUGH_CORRELATION = 0.9; // this is the "bar" for how close a correlation needs to be


function autoCorrelate(buf,sampleRate) {
	var SIZE = buf.length;
	var MAX_SAMPLES = Math.floor(SIZE/2);
	var best_offset = -1;
	var best_correlation = 0;
	var rms=0;
	var foundGoodCorrelation=false;
	var correlations=new Array(MAX_SAMPLES);

	for (var i=0;i<SIZE;i++) {
		var val=buf[i];
		rms+=val*val;
		}
	rms=Math.sqrt(rms/SIZE);
	if (rms < 0.01) 								// not enough signal
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
	
	function updatePitch() 
	{
		var i,y;
		analyser.getFloatTimeDomainData(buf);
		var ac=autoCorrelate(buf,audioContext.sampleRate/2);
		waveCanvas.clearRect(0,0,512,256);
		waveCanvas.strokeStyle="#000099";
		waveCanvas.lineWidth=6;
		waveCanvas.lineCap="round";
		waveCanvas.beginPath();
		waveCanvas.moveTo(0,256-tbuf[1]/2);
		for (var i=1;i<512;i++) {
			if (tbuf[i] == 0)  break;
			y=tbuf[i]-0+((tbuf[i+1]-tbuf[i])/2);					// Mid y										
			waveCanvas.quadraticCurveTo(i*4,256-tbuf[i]/2,i*4+2,256-y/2);
			}
		waveCanvas.stroke();

		if (ac == -1) 
			kk++;	
		else if (ac < 300) {
			pitch=Math.round(ac);
			pitchElem.innerText=pitch;
			tbuf[(jj++)%512]=pitch;
			}
	}

	function updatePitch2() 
	{
		var i,y;
		analyser.getFloatTimeDomainData(buf);
		var ac=autoCorrelate(buf,audioContext.sampleRate/2);
		waveCanvas2.clearRect(0,0,512,256);
		waveCanvas2.strokeStyle="#990000";
		waveCanvas2.lineWidth=6;
		waveCanvas2.lineCap="round";
		waveCanvas2.beginPath();
		waveCanvas2.moveTo(0,256-tbuf[1]/2);
		for (var i=1;i<512;i++) {
			if (tbuf[i] == 0)  break;
			y=tbuf[i]-0+((tbuf[i+1]-tbuf[i])/2);					// Mid y										
			waveCanvas2.quadraticCurveTo(i*4,256-tbuf[i]/2,i*4+2,256-y/2);
			}
		waveCanvas2.stroke();

		if (ac == -1) 
			kk++;	
		else if (ac < 300) {
			pitch=Math.round(ac);
			pitchElem.innerText=pitch;
			tbuf[(jj++)%512]=pitch;
			}
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