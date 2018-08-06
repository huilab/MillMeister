/**
 * @author Erik Werner / https://github.com/erikmwerner
 */
// Copyright 2017, 2018 Erik Werner, UC Irvine
// Based on convertumill2gcode by Phil Duncan

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