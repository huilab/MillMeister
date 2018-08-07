/**
 * @author Erik Werner / https://github.com/erikmwerner
 */
// This script takes an object containing dxf data organized by layer
// and outputs gcode for a CNC mill.
// It is loosely based on CONVERT MICROMILL GCODE v 1.5.1 by Phil Duncan
// Copyright 2017, 2018 Erik Werner, UC Irvine

var warningCount;

function zAdjust(vertex, depth) {
	var adjustedDepth = depth;
	if(zmap.a !== undefined && zmap.b !== undefined && zmap.c !== undefined ) {
		console.log("Plane eq:a:", zmap.a, " b:", zmap.b, " c:",  zmap.c);
		//adjusted.z = z - (0.004 - 0.0000378) * y * 0.00029;
		//(setq zposp (+ zpos (* a xpos) (* b ypos) c))
		adjustedDepth = vertex.z + (zmap.a*vertex.x) + (zmap.b*vertex.y) + zmap.c;
		console.log("Mapped z(",vertex.x,",",vertex.y,"):", depth, " to:", adjustedDepth);
		return adjustedDepth;
	}
	else {
		console.log("Plane map data is not formatted correctly. Returning...");
		return depth;
	}
}

//calculates a ramp to depth d between two points
function rampAdjust(x1, y1, x2, y2, depth, feed, plunge) {
	var e = "\r\n";
	
	//ramp into work
	var adjusted = "G01 X" + x2 + " Y" + y2 + " Z-" + depth+ " F" + plunge + e;
	//move back to start point
	adjusted += "G01 X" + x1 + " Y" + y1 + " F" + feed + e;
	
	return adjusted;
}

function distance2D(x1, y1, x2, y2) {
	return Math.sqrt( ((x2-x1)*(x2-x1)) + ((y2-y1)*(y2-y1)) );
}

//TODO: if units are in --> fixed(4), if units are mm --> fixed(3)
function processLines(layer, depth, stepDown, floor, feed, plunge, zAdjustEnabled) {
	var currentDepth = 0;
	var e = "\r\n";
	
	var logText = "";
	var text = "G90" + e;//switch to absolute coordinates
	
	logText += "Line Layer...Name: " + layer.name + "..." + e;
	logText += "Stepdown: " + stepDown + " " + " floor: " + floor + e;

	if(zAdjustEnabled) {
		logText += "Z plane correction for line ops is disabled" + e;
	}
	
	var object_count = 0;
	var line_count = 0;
	var pline_count = 0;
	var pass_count = 0;
	
	var n_objects = layer.contents.length;
	for(var i = 0; i<n_objects; ++i) {
		var line = layer.contents[i];
		/*if(zAdjustEnabled) {
			var adjustedLine = line;
			for(var i = 0; i<line.vertices.length; ++i){
				adjustedLine.vertices[i] = zAdjust(line.vertices[i], depth);
			}
			line = adjustedLine;
		}*/
		// check what kind of object it is
		if(line.type == "LINE") {
			line_count++;
		}
		else if(line.type == "LWPOLYLINE") {
			pline_count++;
		}
		else {
			var errStr = "Error: entity " + i + " of " + n_objects + " is not of type: LINE or LWPOLYLINE. Type = " + line.type;
			logText += "WARNING: " + errStr + e;
			console.warn(errStr);
			warningCount++;
			continue;
		}
		
		if(line.vertices.length < 2) {
			var errStr = "Error: entity " + i + " of " + n_objects + " has less than two points.";
			logText += "WARNING: " + errStr + e;
			console.warn(errStr);
			warningCount++
			break;
		}
		
		// find the first two points
		var x1 = line.vertices[0].x.toFixed(3);
		var y1 = line.vertices[0].y.toFixed(3);
		var x2 = line.vertices[1].x.toFixed(3);
		var y2 = line.vertices[1].y.toFixed(3);
		
		//rapid to start point
		text += "G00 X"+ x1 + " Y"+ y1 + " Z" + floor + e;
		//lower tool to surface
		text += "G01 Z0." + " F" + plunge + e;
		
		object_count++;
		
		currentDepth = findNextCutDepth(currentDepth, stepDown, depth);
		
		//limit the depth of this pass to the stepDown
		//var firstDepth = Math.min(stepDown, depth);
		//firstDepth = firstDepth.toFixed(3);
		//currentDepth = firstDepth.toString();
		
		//repeat until the correct depth is reached
		while(Number(currentDepth) <= Number(depth)) {
			//console.log("processing polyline depth "+currentDepth);
			//ramp to this depth using the first line segment
			//ramp goes to p2 and back to p1
			text += rampAdjust(x1, y1, x2, y2, currentDepth, feed, plunge);
			
			//Ensure G01 and F(feed) are set
			
			pass_count++;
			//now process all line segments of polyline at this depth
			//starting at p2
			for(var j = 0; j<line.vertices.length - 1; ++j){
				//var p1x = line.vertices[j].x.toFixed(3);
				//var p1y = line.vertices[j].y.toFixed(3);
				var p2x = line.vertices[j+1].x.toFixed(3);
				var p2y = line.vertices[j+1].y.toFixed(3);
				
				text += "X" + p2x + " Y" + p2y + e;
				
			}
			
			//if polyline is closed, go back to the start
			if(layer.contents[i].shape == true) {
				text += "X" + x1 + " Y" + y1 + e;
			}
			
			//raise the tool
			text += "G01 Z" + floor + e;
			
			if(currentDepth < depth) {
				//go to the next depth
				var lastDepth = currentDepth;
				currentDepth = findNextCutDepth(currentDepth, stepDown, depth);
				//return to start point for next pass
				text += "G00 X"+ x1 + " Y"+ y1 + e;
				
				//lower tool to surface
				//text += "G01 Z0." + " F" + plunge + e;
				//lower tool to the last cut depth
				text += "G01 Z-" + lastDepth + " F" + plunge + e;
			}
			else {
				//the current depth equals the target
				//rest depth counter and stop this polyline
				currentDepth = 0;
				break;
			}
			
			//var nextDepth = Number(currentDepth) + stepDown;
			//nextDepth = nextDepth.toFixed(3);
			//currentDepth = nextDepth.toString();
		}
	}
	logText += "Processed layer with " + object_count + " objects (" + line_count;
	logText += " lines and " + pline_count + " polylines) in " + pass_count/object_count + " passes" + e;
	return [text, logText];
}

function findNextCutDepth(currentDepth, stepDown, target) {
	var nextDepth = Number(currentDepth) + Number(stepDown);
	//console.log("polyline::current depth: "+currentDepth+" next depth " + nextDepth);
	if(nextDepth < target) {
		return Number(nextDepth).toFixed(3);
	}
	else {
		return Number(target).toFixed(3);
	}
}


/**
 * Generates g-code for drill operations
 * G83 Peck drilling canned cycle (Group 09) syntax:
 * F feedrate in [units]/min
 * P dwell time after last peck
 * Q cut depth, always incremental
 * R position of the R plane (above the part)
 * X x-axis location of the hole
 * Y y-axis location of the hole
 * Z position of the z-axis at the bottom of the hole
 * 
 * @param {*} layer 
 * @param {*} depth 
 * @param {*} floor 
 * @param {*} feed 
 */
function processCircles(layer, depth, floor, increment, plunge, zAdjustEnabled) {
	var logText = "";
	var text = "";
	var e = "\r\n";
	
	logText += "Drill Layer...Name: " + layer.name + "..." + e;
	logText += "Increment: " + increment + " " + " floor: " + floor + e;
	if(zAdjustEnabled) {
		logText += "Z plane correction for drill ops is disabled" + e;
	}
	
	//depth = depth.toFixed(3);
	//var increment = 0.0008;
	//var dwell = 1.000;
	
	var object_count = 0;
	
	text += "G90" + e;//switch to absolute coordinates
	for(var i=0; i< layer.contents.length; ++i){
		var circle = layer.contents[i];
		 //move to circle point
		text += "G00 X"+ circle.center.x.toFixed(3)+" Y"+circle.center.y.toFixed(3) + e;
		//rapid to movement floor 
		text += "G00 Z" + floor + e;
		//and start canned cycle
		text += "G83 Z-"+ depth + " F"+ plunge + " R" + floor + " Q" + increment + e;
		//bore out the hole one more time
		text += "G01 Z-"+depth + " F"+ plunge + e;
		text += "G01 Z"+floor + " F"+ plunge + e;
		object_count++;
	}
	logText += "Processed " + object_count + " circles" + e;
	return [text, logText];
}

function convertDxfToGCode(dxfGeo) {
	
	//define escape character for convenience
	var e = "\r\n";
	
	//reset warning counter
	warningCount= 0;
	
	//gather global file data
	var fileName = "O" + document.getElementById("inputOperationNumber").value;
	var partName = document.getElementById("inputPartName").value;
	var userName = document.getElementById("inputName").value;
	var increment = document.getElementById("inputPeckRatio").value;
	var date = new Date();
	date = date.toString();
	date = date.replace(/[()]/g, "");
	
	var bossman = document.getElementById("inputPI").value;
	var email= document.getElementById("inputEmail").value;
	var phone= document.getElementById("inputPhone").value;
	var substrateName = document.getElementById("substrateSelect").value;
	var substrateThickness = document.getElementById("inputSubstrateThickness").value;
	
	//var addOptionStop = true;
	//var stepDownRatio = 0.5;
	var addOptionStop =document.getElementById("inputIncludeM01").checked;
	var addBlockNumbers =document.getElementById("inputBlockNumbers").checked;
	var stepDownRatio = document.getElementById("inputStepdown").value;
	var zRef = document.getElementById("inputZRef").value;
	
	if(zRef.indexOf(".") < 0)
	{
		zRef = zRef + ".";
	}
   
	
	//start the gcode file
	var fileText = "%"+ e + fileName + e;
	fileText += "(Part Name: " + partName + ")" + e;
	fileText += "(----------------------------)" + e;
	fileText += "(Generated for: " + userName + ")" + e;
	fileText += "(Date: " + date + ")" + e;
	fileText += "(By " + VERSION_NAME + ")" + e;
	fileText += "(Contact email: " + email + ")" + e;
	fileText += "(Contact phone: " + phone + ")" + e;
	fileText += "(Contact PI: " + bossman + ")" + e;
	+ "(-------BEGIN PROGRAM-------)" + e + "(----------------------------)" + e;
	
	var workPlane = document.getElementById("inputWorkPlane").value;
	fileText += "(INVERSE TIME FEED MODE OFF)" + e + "G94" + e;
	
	var units = document.getElementById("inputUnitSelect").value;
	fileText += "(UNITS: " + units + ")" + e;
	fileText += (units == "Inches") ? "G20" : "G21";
	var unitsShort = (units == "Inches") ? "IN" : "MM";
	fileText += e
	+ "(OPTIONAL PROGRAM STOP)" + e + "M01" + e
	+ "(WORKPLANE G" + workPlane + ")" + e + "G" + workPlane + e;

	 //start a log file
	fileName += ".nc";
	var logName = "Job Info " + fileName + ".txt";
	var logText = "Part Name: " + partName + e;
	logText += "File Name: " + fileName + e;
	logText += "Generated by " + VERSION_NAME + e;
	logText += "Substrate: " + substrateName + " (" + substrateThickness + ") [mm]" + e;
	logText += "Date: " + date + e;
	
	//Sort layers based on processing order
	//If multiple layers have the same processing order, the first one
	//encountered is processed first
	var process_order = new Array();
	
	for(var layer in dxfGeo.layers) {
		var layerName = dxfGeo.layers[layer].name;
		var isEnabled = document.getElementById(layerName).checked;
		//only process enabled layers
		if(!isEnabled) continue;
		
		
		process_order.push(
		{ 
			order: document.getElementById(layerName.concat("processOrder")).value,
			index: layer,
			name: layerName }
		);
	}
	process_order.sort(function(a, b) {
		return a.order - b.order;
	} )
	
	var step = 0;
	//begin processing layers
	for(var layer in process_order){
		step ++;
		var layerName = process_order[layer].name;
		//var layerName = dxfGeo.layers[layer].name;
		//check if the layer is enabled
		var isEnabled = document.getElementById(layerName).checked;
		//only process enabled layers
		if(!isEnabled) continue;
		
		var toolType = document.getElementById(layerName.concat("toolType")).value;// dxfGeo.layers[layer].type;
		var toolNumber = document.getElementById(layerName.concat("toolNumber")).value;
		var toolDiameter = document.getElementById(layerName.concat("diameter")).value;
		var depth = document.getElementById(layerName.concat("depth")).value;
		var feed = document.getElementById(layerName.concat("feed")).value;
		var plunge = document.getElementById(layerName.concat("plunge")).value;
		var floor = document.getElementById(layerName.concat("movementFloor")).value;
		var stepDown = stepDownRatio * toolDiameter;
		var zAdjustEnabled = document.getElementById(layerName.concat("zCorrect")).checked;
		
		
		//check that feed and plunge have decimal points
		//note: HAAS by default wants decimals after integers
		if(depth.indexOf(".") < 0)
		{
			depth = depth + ".";
		}
		if(feed.indexOf(".") < 0)
		{
			feed = feed + ".";
		}
		if(plunge.indexOf(".") < 0)
		{
			plunge = plunge + ".";
		}
		if(floor.indexOf(".") < 0)
		{
			floor = floor + ".";
		}
		
		//this is for if they are numbers
		/*feed.toFixed(3);
		plunge.toFixed(3);
		floor.toFixed(3);*/
		logText += e + "Step " + step;
		logText += e + "Processing layer " + (Number(process_order[layer].index) + 1) + " of " + dxfGeo.layers.length + "..." + e;
		logText += "-----------------------------------" + e;
		
		//write layer description
		fileText += e; // leave a blank line before the comment block
		if(addBlockNumbers) {
			fileText += "N" + step + e; // add block numbers
		}
		fileText += "(----------------------------)" + e; 
		fileText += "(--Step " + step + " of " + process_order.length + "--)" + e;
		fileText += "(Layer name: "+ layerName + " )" + e;
		fileText += "(Tool # " + toolNumber + ")" + e;
		fileText += "(Tool Type: " + toolType + ")" + e;
		fileText += "(Depth: "+ depth + " " + unitsShort + ")" +e;
		fileText += "(----------------------------)" + e;
		
		logText += "Tool number " + toolNumber + ": " + toolDiameter + " " + toolType + " to depth: " + depth + " " + unitsShort + e;
		
		//change tool and offset
		fileText += "T" + toolNumber + " M06" + e + 
		"G43 H" + toolNumber + e;
		
		if(addOptionStop) {
			fileText += "M01 (Option Stop)" + e + e;
		}
		
		// TK TODO add support for CCW tools
		var dir = "CW";
		fileText += (dir == "CW") ? "M03" : "M04";
		
		var rpm = document.getElementById(layerName.concat("rpm")).value;
		fileText += " S" + rpm + e;
		
		//dwell for 2s before moving to allow spindle to spin up
		fileText += "G04 P2.0" + e + e;
		
		switch(dxfGeo.layers[process_order[layer].index].type) {
		case "LINE":
			data = processLines(dxfGeo.layers[process_order[layer].index], depth, stepDown, floor, feed, plunge, zAdjustEnabled);
			fileText += data[0];
			logText += data[1];
			break;
		case "LWPOLYLINE":
			data = processLines(dxfGeo.layers[process_order[layer].index], depth, stepDown, floor, feed, plunge, zAdjustEnabled);
			fileText += data[0];
			logText += data[1];
			break;
		case "POLYLINE":
			data = processLines(dxfGeo.layers[process_order[layer].index], depth, stepDown, floor, feed, plunge, zAdjustEnabled);
			fileText += data[0];
			logText += data[1];
			break;
		case "CIRCLE":
			data = processCircles(dxfGeo.layers[process_order[layer].index], depth, floor, increment, feed, plunge, zAdjustEnabled);
			fileText += data[0];
			logText += data[1];
			break;
		case "TEXT":
			var errStr ="Text entities are not supported";
			console.warn(errStr);
			warningCount++;
			logText += "WARNING: " + errStr + e;
			break;
		default:
			var errStr ="This layer contains unsupported objects. Type: ";
			errStr += dxfGeo.layers[process_order[layer].index].type ;
			console.warn(errStr);
			warningCount++;
			logText += "WARNING: " + errStr + e;
			break;
		}	  
	}
	
	
	if(zRef == null) {
		zRef = 75.0; //75mm
	}
	fileText += "(RETURN TO REFERENCE)" + e;
	fileText += "G91 G28 X0 Y0 Z" + zRef + e;
	
	//finish the gcode with an M30
	fileText += "(------END PROGRAM------)" + e + "M30" + e + "%" + e;
	
	var warningString = e + "gcode conversion completed with " + warningCount + " warnings";
	logText += warningString + e;
	console.log(warningString);
	return [fileName, fileText, logName, logText];
}
