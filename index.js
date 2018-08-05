/**
 * @author Erik Werner / https://github.com/erikmwerner
 */
// This is the main js file for MillMeister. It handles ui i/o.
// Copyright 2017, 2018 Erik Werner, UC Irvine
// Based on convertumill2gcode by Phil Duncan

const VERSION_NAME = "MillMeister Version 1.1.1 build 5";

var gCodeBlob = null;
var gCodeFileName = null;
var gCodeContents = null;
var jobInfoFileName = null;
var jobInfoContents = null;

var zmap = {a:0,b:0,c:0};
var selectedSubstrate = null;

var progress = document.getElementById("file-progress-bar");
var $progress = $(".progress");

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

	console.log( VERSION_NAME );
	if (localStorage) {
		tryLoadUserInfo();
	} else {
		console.log("No local storage support");
	}	
}) 


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



//event listeners
document.getElementById("dxfView").addEventListener("dragover", onDragOver, false);
document.getElementById("dxfView").addEventListener("drop", onDrop, false);
document.getElementById("dxfSelect").addEventListener("change", onDxfFileSelected, false);
document.getElementById("vMapSelect").addEventListener("change", onMapFileSelected, false);

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

	progress.style.width = "0%";
	progress.textContent = "0%";
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
	console.log(Math.round((evt.loaded /evt.total) * 100));
	if(evt.lengthComputable) {
		var percentLoaded = Math.round((evt.loaded /evt.total) * 100);
		if (percentLoaded < 100) {
			progress.style.width = percentLoaded + "%";
			progress.textContent = percentLoaded + "%";
		}
	}
}

function onDxfReadSuccess(evt){
	// load in DXF file
	var fileReader = evt.target;
	if(fileReader.error) return console.log("error on load end");


	progress.style.width = "100%";
	progress.textContent = "100%";
	setTimeout(function() { $progress.removeClass("loading"); }, 2000);

	var parser = new window.DxfParser();
	var dxf = parser.parseSync(fileReader.result);
	
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
			console.log( (xhr.loaded / xhr.total * 100) + "% loaded" );
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

// 
function setFiveDigit(elm) {
	var newValue = elm.value.toString();
	var digits = newValue.length;
	while(digits < 5){
		newValue = "0" + newValue;
		digits = newValue.length;
	}
	elm.value = newValue;
}

// prepares the main tool parameter table
function buildTable(dxfGeo){
	//default maxDepth is 1.0mm (0.04")
	var maxDepth = document.getElementById("inputSubstrateThickness").value;
	var tableText = "";
	var stepCount = 0;
	
	for (var i=0; i<dxfGeo.layers.length; ++i) {
		var layerName = dxfGeo.layers[i].name;
		var tool = guessToolType(layerName);
		var toolDiameter = guessToolDiameter(layerName);
		var depth = guessDepth(layerName, maxDepth);
		var feed = guessFeedSpeed(toolDiameter, 1, 100.0);
		var plunge = guessFeedSpeed(toolDiameter, 2, 50.0);
		
		//set the processing order to zero if the layer is not enabled
		//if the layer is enabled, increment the number of layers
		//processed and set this layer to the next number
		var opOrder = 0;

		if( tool != "Unknown" ) {
			stepCount++;
			opOrder = stepCount;
		}
		
		tableText+="<tr>";
		/*tableText+=generateTableRow(
		opOrder, dxfGeo.layers[i].contents.length, 
		dxfGeo.layers[i].type, dxfGeo.layers[i].color, 
		layerName, tool, toolDiameter, depth, feed, plunge);
		tableText +="</tr>";	*/

		tableText+=generateTableRow(
			opOrder, dxfGeo.layers[i], tool, 
			toolDiameter, depth, feed, plunge);
			tableText +="</tr>";


	}
	return tableText;
};
//function generateTableRow(opOrder, layer, type, color, layerName, tool, toolDiameter, depth, feed, plunge) {
function generateTableRow(opOrder, layer, tool, toolDiameter, depth, feed, plunge) {
	var layerName = layer.name;
	var type = layer.type;
	var color = layer.color;
	var count = layer.contents.length;
	//col 0 checkbox to enable
	var text="<td><input type=\"checkbox\" name=\"" + layerName + 
	"\" id=\"" + layerName + "\" " + (tool == "Unknown" ? "" : "checked") + ">" + 
	"<input type=\"number\" name=\""+ layerName.concat("processOrder") +
	"\" id=\""+layerName.concat("processOrder") + "\" value= \"" + opOrder	 + "\" min = \"0\"></td>";
	// with label included
	/*var text="<td><label for=\"" + layerName + "\">#<input type=\"checkbox\" name=\"" + layerName + 
	"\" id=\"" + layerName + "\" " + (tool == "Unknown" ? "" : "checked") + ">" + 
	"<input type=\"number\" name=\""+ layerName.concat("processOrder") +
	"\" id=\""+layerName.concat("processOrder") + "\" value= \"" + opOrder	 + "\" min = \"0\" max = \"" + layer.length +"\"></label></td>";*/


	//col 1 name
	text+="<td>" + layerName + " </td>";

	//col 2 entity count
	text+="<td>" + count + " </td>";

	//col 3 type
	text+="<td>" + type + "</td>"

	//col 4 color
	text+="<td>" + color + "</td>";

	//col 5 tool type. guess the tool from the name
	//tableText+="<td><div id=\""+layerName.concat("toolType")+ "\">" + tool + "</td>";
	text+="<td><select class=\"form-control\" id=\"" + layerName.concat("toolType") + "\">";
	if(tool == "Drill") {
		text+="<option selected value = \"Drill\">Drill</option>" +
		"<option value = \"Endmill\">Endmill</option>" +
		"<option value = \"Unknown\">Unknown</option>";
	}
	else if(tool == "Endmill"){
		text+="<option value = \"Drill\">Drill</option>" +
		"<option selected value = \"Endmill\">Endmill</option>" +
		"<option value = \"Unknown\">Unknown</option>";
	}
	else{
		text+="<option value = \"Drill\">Drill</option>" +
		"<option value = \"Endmill\">Endmill</option>" +
		"<option selected value = \"Unknown\">Unknown</option>";
	}
	text += "</select></td>"; 

	//col 6 tool diameter
	text+="<td><input type=\"number\" name=\""+ layerName.concat("diameter") +
	"\" id=\""+layerName.concat("diameter") + "\" value=" + toolDiameter + "></td>";

	//col 7 tool number. requires manual editing
	text+="<td><input type=\"number\" name=\""+ layerName.concat("toolNumber") +
	"\" id=\""+layerName.concat("toolNumber") + "\" value=" + 0 + "></td>";

	//col 8 guess the depth from the name
	text+="<td><input type=\"number\" name=\""+ layerName.concat("depth") +
	"\" id=\""+layerName.concat("depth") + "\" value=" + depth + "></td>";

	//col 9 guess the feed from the tool and material
	text+="<td><input type=\"number\" name=\""+ layerName.concat("feed") +
	"\" id=\""+layerName.concat("feed") + "\" value=" + feed + "></td>";

	//col 10
	text+="<td><input type=\"number\" name=\""+ layerName.concat("plunge") +
	"\" id=\""+layerName.concat("plunge") + "\" value=" + plunge + "></td>";

	//col 11
	text+="<td><input type=\"number\" name=\""+ layerName.concat("rpm") +
	"\" id=\""+layerName.concat("rpm") + "\" value=" + 6000 + "></td>";

	//col 12 spindle direction is CW or CCW TK TODO: add support for CCW tools
	text+="<td>CW</td>";

	//col 13 default to plane correction
	text+="<td><input type=\"checkbox\" name=\""+ layerName.concat("zCorrect") + 
	"\" id=\"" + layerName.concat("zCorrect") + "\"></td>";

	// col 14 movement floor
	text+="<td><input type=\"number\" name=\""+ layerName.concat("movementFloor") +
	"\" id=\""+layerName.concat("movementFloor") + "\" value=" + 1.0 + "></td>";
	
	return text;
}

function guessToolType(layerName) {
	if(layerName.search(/ Drill /i) >= 0) {
		return "Drill";
	}
	else if(layerName.search(/ Endmill /i) >= 0) {
		return "Endmill"
	}
	else if(layerName.search(/ EM /i) >= 0) {
		return "Endmill"
	}
	else if(layerName.search(/ D /i) >= 0) {
		return "Drill";
	}
	else {
		return "Unknown"
	}
};

// Assume diameter is second word of layer name
// TK change to search the word before and after the toolType
function guessToolDiameter(layerName) {
	var diameter = 0.02; //default to 200 micron
	var words = layerName.split(" "); // split by spacing
	if(words.length >= 2) { //check there are at least two words
		var n = words[1].search(/mm/i);
		//var n = words[1].indexOf("mm"); //check for a layer in mm
		if(n > 0){
			return parseFloat(words[1].substring(0,n));
		}
		//if not mm, check for inches
		n = words[1].search(/in/i);
		//n = words[1].indexOf("in");
		if(n > 0){
			return parseFloat(words[1].substring(0,n));
		}
	}
	//nothing was found, return default value
	return diameter;
}

// asume depth is the fourth word
function guessDepth(name, maxDepth) {
	var depth = 0;
	var words = name.split(" ");
	//search each word
	for(var i = 0; i<words.length; ++i) {
		var n = words[i].search(/Z/i);
		if(n >= 0){//found " Z "
			if(i < words.length - 1){
				// case insensitive search for mm
				var m = words[i+1].search(/mm/i);
				//case insensitive seach for in
				var inch = words[i+1].search(/in/i);

				//through
				var thru1 = words[i+1].search(/thru/i);
				var thru2 = words[i+1].search(/through/i);

				if(m >=0){
					return parseFloat(words[i+1]);
				}
				else if(inch >=0){
					return parseFloat(words[i+1]);
				}
				else if(thru1 >=0 || thru2 >=0){
					return maxDepth;
				}
			}
		}
	}
	return depth;
};

function guessFeedSpeed(toolDiameter, index, defaultValue) {
	var returnValue = defaultValue;
	Object.entries(speeds).forEach(
		([key, value]) => {
			if(key == selectedSubstrate) {
				for (var i = 0; i < value.length; i++) {
					if(value[i][0]>=toolDiameter) {
						returnValue = value[i][index];
						return;
					}
				}
			}
		}
	);
	return returnValue;
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
	openGCodeFromText(data[1]);
	openJobInfoFromText(data[3]);
	
	saveUserInfo();
}

function saveUserInfo() {
	var opNum = document.getElementById("inputOperationNumber").value;
	localStorage.setItem("opNum", opNum);
	var name = document.getElementById("inputName").value;
	localStorage.setItem("name", name);
	var pi = document.getElementById("inputPI").value;
	localStorage.setItem("pi", pi);
	var partName = document.getElementById("inputPartName").value;
	localStorage.setItem("partName", partName);
	var email = document.getElementById("inputEmail").value;
	localStorage.setItem("email", email);
	var phone = document.getElementById("inputPhone").value;
	localStorage.setItem("phone", phone);
	console.log("saved settings to local storage");
}

function tryLoadUserInfo() {
	console.log("loading settings from local storage");
	// Retrieve saved data from last use
	var opNum = localStorage.getItem("opNum");
	if (opNum != "undefined" && opNum != "null") {
		document.getElementById("inputOperationNumber").value = opNum;
	}
	var name = localStorage.getItem("name");
	if (name != "undefined" && name != "null") {
		document.getElementById("inputName").value = name;
	}
	var pi = localStorage.getItem("pi");
	if (pi != "undefined" && pi != "null") {
		document.getElementById("inputPI").value = pi;
	}
	var partName = localStorage.getItem("partName");
	if (partName != "undefined" && partName != "null") {
		document.getElementById("inputPartName").value = partName;
	}
	var email = localStorage.getItem("email");
	if (email != "undefined" && email != "null") {
		document.getElementById("inputEmail").value = email;
	}
	var phone = localStorage.getItem("phone");
	if (phone != "undefined" && phone != "null") {
		document.getElementById("inputPhone").value = phone;
	}
}

function openGCodeFromText(gcode) {
	var toolPathDiv = document.getElementById("gCodeView");

	while(toolPathDiv.firstChild){
		toolPathDiv.removeChild(toolPathDiv.firstChild);
	}
	var textPreview = document.getElementById("gCodeTextPreview");
	var scene = createGCodeScene(toolPathDiv);
	var substrateLength = document.getElementById("inputPartExtentsX").value;
	var substrateWidth = document.getElementById("inputPartExtentsY").value;
	var substrateHeight = document.getElementById("inputSubstrateThickness").value;
	var substrateGeo = new THREE.BoxGeometry( substrateLength, substrateWidth, substrateHeight );
	var substrateMat = new THREE.MeshBasicMaterial( {color: 0x00ff00, transparent:true, opacity:0.5 } );
	var substrateBox = new THREE.Mesh( substrateGeo, substrateMat );
	
	// create toolpath geo and add to scene
	createObjectFromGCode(gcode, scene);
	
	//add the substrate geo to the scene
	substrateBox.position.set(substrateLength/2, substrateWidth/2, -substrateHeight/2);
	scene.add( substrateBox );

	// add gcode file contents to preview
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
}

/*
// disable table rows using first row checkboxes
//https://jsfiddle.net/ddan/1rhrco48/
$("tr td:first-child input[type="checkbox"]").click( function() {
   //enable/disable all except checkboxes, based on the row is checked or not
   $(this).closest("tr").find(":input:not(:first)").attr("disabled", !this.checked);
});*/

());
