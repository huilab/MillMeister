/**
 * @author Erik Werner / https://github.com/erikmwerner
 */
// This is the main js file for MillMeister. It handles ui i/o.
// Copyright 2017, 2018 Erik Werner, UC Irvine
// Based on convertumill2gcode by Phil Duncan

const VERSION_NAME = "MillMeister Version 1.2";

var gCodeBlob = null;
var gCodeFileName = null;
var gCodeContents = null;
var jobInfoFileName = null;
var jobInfoContents = null;

var zmap = {a:0,b:0,c:0};
var selectedSubstrate = null;

var dxfLoadProgress = document.getElementById("file-progress-bar");
var $progress = $(".progress");
var parser = new window.DxfParser();
var demoFileName = "data/demo.dxf";

var gCodeViewDiv = document.getElementById("gCodeView");
var gCodeGuiDiv = document.getElementById("gcode-gui");

var saveBlob = (function () {
	var a = document.createElement("a");
	document.body.appendChild(a);
	a.style = "display: none";
	return function (blob, fileName) {
		var url = window.URL.createObjectURL(blob);
		a.href = url;
		a.download = fileName;
		a.click();
		window.URL.revokeObjectURL(url);
	};
})

var speeds = {
	"COC" : [
	[0.05,	50,		20	],
	[0.075,	75,		30	],
	[0.1,	120,	60	],
	[0.15,	150,	80	],
	[0.2,	200,	100	],
	[0.5,	300,	200	],
	[1.0,	400,	300	],
	[2.0,	600,	400	]],
	"COP" : [
	[0.05,100,60	],
	[0.1,150,80		],
	[0.2,200,100	],
	[0.5,300,200	],
	[1.0,400,300	],
	[2.0,600,400	]],
	"PMMA" : [
	[0.05,50,40		],
	[0.1,80,60		],
	[0.2,100,80		],
	[0.5,200,150	],
	[1.0,300,200	],
	[2.0,400,300	]]
};


// Do once the page has loaded 
$(document).ready(function(){ 
	document.getElementById("versionString").innerHTML = VERSION_NAME;
	document.getElementById("substrateSelect").innerHTML = fillSubstrates( speeds );
	document.getElementById("collapseFeedSpeedInfoTextPreview").innerHTML = fillFeedsSpeeds( speeds );

	//attach event listeners
	document.getElementById("dxfView").addEventListener("dragover", onDragOver, false);
	document.getElementById("dxfView").addEventListener("drop", onDrop, false);
	document.getElementById("dxfSelect").addEventListener("change", onDxfFileSelected, false);
	document.getElementById("vMapSelect").addEventListener("change", onMapFileSelected, false);

	console.log( VERSION_NAME );
	if (localStorage) {
		tryLoadUserInfo();
	} else {
		console.log("No local storage support");
	}	
}) 

$.ajax({
	type:    "GET",
	url:     demoFileName,
	success: function(text) {
			// `text` is the file text
			console.log("got demo file text");
			parseDxfText(text);
			document.getElementById("fileDescription").innerHTML = "<ul><li><strong>" + demoFileName + "</li></ul>";
			dxfLoadProgress.style.width = "100%";
			dxfLoadProgress.textContent = "Demo Loaded";
	},
	error:   function() {
			// An error occurred
			console.log("error opening demo file");
	}
});


function fillSubstrates( speeds ) {
	var output = [];
	Object.entries( speeds ).forEach(
		([ key, value ]) => {
			output.push("<option value = \"", key, "\">",key,"</option>");
			if( selectedSubstrate == null ) {
				selectedSubstrate = key;
			}
		}
	);
	return output.join("");
}

function fillFeedsSpeeds(speeds) {
	var output = ["<table>"];
	output.push("<th>Tool Dia. [mm]</th><th>Feed [mm/min]</th><th>Speed [mm/min]</th>");
	Object.entries(speeds).forEach(
		([ key, value ]) => {
			if( key == selectedSubstrate ) {
				for ( var i = 0; i < value.length; i++ ) {
					output.push("<tr>");
					for ( var j = 0; j < value[i].length; j++ ) {
						output.push("<td>" , value[i][j] , "</td>");
					}
					output.push("</tr>");
				}
			}
		}
	);
	output.push("</table><h5>Substrate: " + selectedSubstrate + "</h5>");
	return output.join("");			
}

document.getElementById("substrateSelect").onchange = function() {
  var index = this.selectedIndex;
  var inputText = this.children[index].innerHTML.trim();
  selectedSubstrate = inputText;
  console.log("Substrate changed to: " + selectedSubstrate);
  document.getElementById("collapseFeedSpeedInfoTextPreview").innerHTML = fillFeedsSpeeds(speeds);
}

function onDragOver(evt) {
	evt.stopPropagation();
	evt.preventDefault();
	evt.dataTransfer.dropEffect = "copy"; // Explicitly show this is a copy.
}

function onDrop(evt) {
  // Prevent default behavior (Prevent file from being opened)
  evt.preventDefault();
	for ( var i = 0; i < evt.dataTransfer.files.length; i++ ) {
	  loadDxfFile( evt.dataTransfer.files[i] );//.name?
	}
  // Pass event to removeDragData for cleanup
  removeDragData( evt );
}

function removeDragData( evt ) {
  if ( evt.dataTransfer.items ) {
	// Use DataTransferItemList interface to remove the drag data
	evt.dataTransfer.items.clear();
  } else {
	// Use DataTransfer interface to remove the drag data
	evt.dataTransfer.clearData();
  }
}

function onDxfFileSelected( evt ) {
	var file = evt.target.files[0];
	loadDxfFile( file );
}

function loadDxfFile( file ) {
	var output = [];
	var reader = new FileReader();

	dxfLoadProgress.style.width = "0%";
	dxfLoadProgress.textContent = "0%";
	$progress.addClass("loading");

	//display file info
	output.push("<li><strong>", encodeURI( file.name ), "</strong> (", file.type || "n/a", ") <br> ",
		file.size, " bytes, last modified: ",
		file.lastModifiedDate ? file.lastModifiedDate.toLocaleDateString() : "n/a",
		"</li>");
	document.getElementById("fileDescription").innerHTML = "<ul>" + output.join("") + "</ul>";

	// attach callbacks to reader
	reader.onprogress = updateProgress;
	reader.onloadend = onDxfReadSuccess;
	reader.onabort = abortUpload;
	reader.onerror = errorHandler;

	// read the file
	reader.readAsText( file );
	localStorage.setItem("last-file", file);
}

function onMapFileSelected( evt ) {
	var file = evt.target.files[0];
	if( file ) {
		var reader = new FileReader();
		reader.onloadend = onMapReadSuccess;
		reader.readAsText( file );
	}
}

function onMapReadSuccess(evt) {
	var fileReader = evt.target;
	var mapDataText = fileReader.result;
	var coefficients;
	mapDataText = mapDataText.replace(/[{()}]/g, ""); //trim parenthesis
	coefficients = mapDataText.split(",");

	if( coefficients.length >=3 ) {
		var output = [];
		var units = coefficients[0];
		
		//compare first word to regular expressions to determine units
		if((/mm/i).test( units ) > 0) {
			output.push("Units: MM <br>");
		}
		else if ((/IN/i).test( units ) > 0) {
			output.push("Units: Inches <br>");
		}
		
		output.push("A: ",coefficients[0],", B: ",coefficients[1],", C: ",coefficients[2],"<br>");
		output.push("D = ",coefficients[0],"x + ",coefficients[1]," y + ",coefficients[2]," z");
		document.getElementById("mapDescription").innerHTML = "<ul>" + output.join("") + "</ul>";
	
		zmap.a = coefficients[0];
		zmap.b = coefficients[1];
		zmap.c = coefficients[2];
	}
	else {
		console.warn("Z-plane data does not contain at least three terms");
	}
}

function abortUpload() {
	console.log("File read aborted");
}

function errorHandler(evt) {
	switch(evt.target.error.code) {
	case evt.target.error.NOT_FOUND_ERR:
		alert("File Not Found!");
		break;
	case evt.target.error.NOT_READABLE_ERR:
		alert("File is not readable");
		break;
	case evt.target.error.ABORT_ERR:
		break; // noop
	default:
		alert("An error occurred reading this file");
	}
}

function updateProgress(evt) {
	if(evt.lengthComputable) {
		var percentLoaded = Math.round((evt.loaded /evt.total) * 100);
		if (percentLoaded < 100) {
			dxfLoadProgress.style.width = percentLoaded + "%";
			dxfLoadProgress.textContent = percentLoaded + "%";
		}
	}
}

function onDxfReadSuccess(evt){
	// load in DXF file
	var fileReader = evt.target;
	if(fileReader.error) return console.log("filereader error");

	dxfLoadProgress.style.width = "100%";
	dxfLoadProgress.textContent = "100%";
	setTimeout(function() { $progress.removeClass("loading"); }, 2000);

	
	parseDxfText(fileReader.result);
}

function parseDxfText(text) {
	var dxf = parser.parseSync(text);
	
	// generate text preview
	var textPreview = document.getElementById("dxfTextPreview");
	textPreview.innerHTML = JSON.stringify(dxf, null, 4);
	
	var dxfPreviewDiv = $("#dxfTextPreviewContainer");
	if (!dxfPreviewDiv.is(":visible")) {
		dxfPreviewDiv.collapse("toggle");
	}

	// grab geometry for preview
	dxfGeo = getGeo(dxf);
	
	// generate 3D preview
	var dxfDiv = document.getElementById("dxfView");

	// removes previous dxf model
	while(dxfDiv.firstChild){
		dxfDiv.removeChild(dxfDiv.firstChild);
	}
	// Note: Three.js changed the way fonts are loaded, and now we need to use FontLoader to load a font
	// and enable TextGeometry. See this example http://threejs.org/examples/?q=text#webgl_geometry_text
	// and this discussion https://github.com/mrdoob/three.js/issues/7398
	var loader = new THREE.FontLoader();
	var font = loader.load(
		"fonts/helvetiker_regular.typeface.json",
		function ( font ) {
			// load scene without the font
			console.log("Loading scene without a font");
			var dxfScene = new ThreeDxf.Viewer(dxf, dxfDiv, 500, 500, font);
		},
		// Function called when download progresses
		function ( xhr ) {
			console.log("Loading font");
			console.log( (xhr.loaded / xhr.total * 100) + "% font loaded" );
		},
		// Function called when download errors.
		// Load scene without the font
		function ( xhr ) {
			console.log( "An error occurred loading font" );
			var dxfScene = new ThreeDxf.Viewer(dxf, dxfDiv, 500, 500, font);
		}
	);
	
	// populate a table from DXF layer data
	var tableDiv = $("#paramTable");
	if (!tableDiv.is(":visible")) {
		tableDiv.collapse("toggle");
	}
	document.getElementById("paramTableBody").innerHTML = buildTable(dxfGeo);
}

// enforce numbered program conventions from HAAS
function setFiveDigit(elm) {
	var newValue = elm.value.toString();
	var digits = newValue.length;
	while(digits < 5){
		newValue = "0" + newValue;
		digits = newValue.length;
	}
	elm.value = newValue;
}


function generateGCode() {	
	var data = convertDxfToGCode(dxfGeo);
	var resultsDiv = $("#results");
	if (!resultsDiv.is(":visible")) {
		resultsDiv.collapse("toggle");
	}
	gCodeFileName = data[0];
	gCodeContents = data[1];
	jobInfoFileName = data[2];
	jobInfoContents = data[3];
	
	gCodeBlob = new Blob([gCodeContents], {endings: "transparent"});
	jobInfoBlob = new Blob([jobInfoContents], {endings: "transparent"});
	//<div class="loader"></div>
	openGCodeFromText(data[1]);
	openJobInfoFromText(data[3]);
	
	saveUserInfo();
}

function openGCodeFromText(gcode) {
	// clear out the gCodeViewDiv
	while(gCodeViewDiv.firstChild){
		gCodeViewDiv.removeChild(gCodeViewDiv.firstChild);
	}
	while(gCodeGuiDiv.firstChild){
		gCodeGuiDiv.removeChild(gCodeGuiDiv.firstChild);
	}
	// repopulate gCodeViewDiv
	var scene = createGCodeScene(gCodeViewDiv);
	// create toolpath geo and add to scene
	createObjectFromGCode(gcode, scene);

	// add gcode file contents to preview
	var textPreview = document.getElementById("gCodeTextPreview");
	textPreview.innerHTML = gcode;//JSON.stringify(gcode, null, 4);
}

function openJobInfoFromText(jobInfo) {
	var textPreview = document.getElementById("jobInfoTextPreview");
	textPreview.innerHTML = jobInfo;//JSON.stringify(gcode, null, 4);
}

function saveGcodeFile() {
	if(gCodeBlob != null && gCodeFileName != null) {
		saveBlob(gCodeBlob, gCodeFileName);
	}
}

function saveJobInfoFile() {
	if(jobInfoBlob != null && jobInfoFileName != null) {
		saveBlob(jobInfoBlob, jobInfoFileName);
	}
}

function saveUserInfo() {
	function saveInfo(itemName, elementId) {
		var temp = document.getElementById(elementId).value;
		localStorage.setItem(itemName, temp);
	}
	saveInfo("opNum","inputOperationNumber");
	saveInfo("name","inputName");
	saveInfo("pi","inputPI");
	saveInfo("partName","inputPartName");
	saveInfo("email","inputEmail");
	saveInfo("phone","inputPhone");
	console.log("saved settings to local storage");
}

function tryLoadUserInfo() {
	console.log("Loading settings from local storage");
	function tryLoad(itemName, elementId) {
		var temp = localStorage.getItem(itemName);
		if (temp != "undefined" && temp != "null" && temp != "") {
			document.getElementById(elementId).value = temp;
		}
	}
	tryLoad("opNum", "inputOperationNumber");
	tryLoad("name", "inputName");
	tryLoad("pi", "inputPI");
	tryLoad("partName", "inputPartName");
	tryLoad("email", "inputEmail");
	tryLoad("phone", "inputPhone");
}
/*
// disable table rows using first row checkboxes
//https://jsfiddle.net/ddan/1rhrco48/
$("tr td:first-child input[type="checkbox"]").click( function() {
   //enable/disable all except checkboxes, based on the row is checked or not
   $(this).closest("tr").find(":input:not(:first)").attr("disabled", !this.checked);
});*/

