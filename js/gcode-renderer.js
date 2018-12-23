// G-code toolpath simulation

function findExtents(scene) { 
	for(var child of scene.children) {
		var minX, maxX, minY, maxY;
		if(child.position) {
			minX = Math.min(child.position.x, minX);
			minY = Math.min(child.position.y, minY);
			maxX = Math.max(child.position.x, maxX);
			maxY = Math.max(child.position.y, maxY);
		}
	}

	return { min: { x: minX, y: minY }, max: { x: maxX, y: maxY }};
}

function createGCodeScene(parent, zmap) {
	var $parent = $(parent);
	var width = $parent.innerWidth();
	var height = $parent.innerHeight();
	
	// Scene
  var scene = new THREE.Scene(); 
  scene.background = new THREE.Color( 0xFFFFFF );
  // Renderer
  var renderer = new THREE.WebGLRenderer( { alpha: true } );
  renderer.setClearColor( 0xffffff, 0 );
  renderer.setSize(width, height);
  $parent.append(renderer.domElement);
  renderer.clear();

  

  // Lights...
  [[0,0,1,  0xFFFFCC],
   [0,1,0,  0xFFCCFF],
   [1,0,0,  0xCCFFFF],
   [0,0,-1, 0xCCCCFF],
   [0,-1,0, 0xCCFFCC],
   [-1,0,0, 0xFFCCCC]].forEach(function(position) {
    var light = new THREE.DirectionalLight(position[3]);
    light.position.set(position[0], position[1], position[2]).normalize();
    scene.add(light);
  });

  // Camera...
  var fov    = 45,
      aspect = width / height,
      near   = 0.1,
      far    = 10000,
      camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
  camera.rotationAutoUpdate = true;
  
  camera.position.x = 0;
  camera.position.y = -50;
  camera.position.z = 50;
  camera.lookAt(scene.position);
  scene.add(camera);
  
  //add arrow helper
  var origin = new THREE.Vector3( 0, 0, 0 );
	var x_dir = new THREE.Vector3( 1, 0, 0 );
	var y_dir = new THREE.Vector3( 0, 1, 0 );
	var z_dir = new THREE.Vector3( 0, 0, 1 );
	
	//normalize the direction vectors (convert to vector of length 1)
	origin.normalize();
	x_dir.normalize();
	y_dir.normalize();
	z_dir.normalize();
	
	var length = 10;

	var arrowHelper = new THREE.ArrowHelper( x_dir, origin, length, 0xff0000, 0.2*length, 0.1*length );
	scene.add( arrowHelper );
	var arrowHelper2 = new THREE.ArrowHelper( y_dir, origin, length, 0x00ff00, 0.2*length, 0.1*length );
	scene.add( arrowHelper2 );
	var arrowHelper3 = new THREE.ArrowHelper( z_dir, origin, length, 0x0000ff, 0.2*length, 0.1*length );
	scene.add( arrowHelper3 );
	
	// create a set of coordinate axes to help orient user
	// specify length in pixels in each direction
	//var axes = new THREE.AxisHelper(100);
	//scene.add( axes );


  // add the substrate in the scene
  var substrateLength = document.getElementById("inputPartExtentsX").value;
  var substrateWidth = document.getElementById("inputPartExtentsY").value;
  var substrateHeight = document.getElementById("inputSubstrateThickness").value;
  var substrateGeo = new THREE.BoxGeometry( substrateLength, substrateWidth, substrateHeight );
  var substrateMat = new THREE.MeshBasicMaterial( {color: 0x00ff00, transparent:true, opacity:0.5 } );
  var substrateBox = new THREE.Mesh( substrateGeo, substrateMat );

  substrateBox.position.set(substrateLength/2, substrateWidth/2, -substrateHeight/2);
  scene.add( substrateBox );

  // 48" travel = 1176 mm
  var largerSide = Math.max(substrateLength, substrateWidth);
  // visualize z-adjustment plane
  var plane = new THREE.Plane();

  // the plane equation is z = f(x,y) = ax + by + c
  // p1 let x = 0  y = 0
  // p2 let x = 100 , y = 0
  // p3 let x = 0, y = 100
  plane.setFromCoplanarPoints( new THREE.Vector3( 0, 0, 0 ), new THREE.Vector3( 100 , 0, zmap.a*100 + zmap.c ), new THREE.Vector3( 0, 100, zmap.b*100 + zmap.c ));
  //plane.setFromCoplanarPoints( new THREE.Vector3( 0, 0, 0 ), new THREE.Vector3( 1, 0, 0 ), new THREE.Vector3( 0, 1, 0 ));
  plane.translate( new THREE.Vector3( largerSide/2, 0, 0 ) );
  var planeHelper = new THREE.PlaneHelper( plane, largerSide, 0xffff00 );
  scene.add( planeHelper );


  // add camera controls GUI
  var gcodeViewGui = new dat.GUI( { autoPlace: false } );
  var myContainer = document.getElementById('gcode-gui');
  myContainer.appendChild(gcodeViewGui.domElement);
  //gcodeViewGui.domElement.id = "gcode-gui";
  var gui_controls = {
    reset: function() {
      camera.position.x = 0;
      camera.position.y = -50;
      camera.position.z = 50;
      camera.lookAt(scene.position);
    }
  };

  //var gcodeViewGui = new dat.GUI( );
  //var  = gcodeViewGui.addFolder("Substrate");
  gcodeViewGui.add( gui_controls, "reset" ).name("Reset camera");
  gcodeViewGui.add( substrateBox, 'visible' ).name("Show substrate");
  gcodeViewGui.add( planeHelper, 'visible' ).name("Show correction plane");

  // create camera controls
  // Trackball controls works well with an animation loop, but doesn't update nicely on change events
  // Orbit controls (used for 2d dxf graphics) works with change events to save CPU
  
  // /*
  var controls = new THREE.TrackballControls(camera, parent);
  controls.screen.width = width;
  controls.screen.height = height;
  controls.dynamicDampingFactor = 0.5;
  controls.panSpeed = 1.2;
  controls.rotateSpeed = 2.4;
  controls.zoomSpeed = 1.2;
  const fps = 1000/50;
  // */
  /*
  var controls = new THREE.OrbitControls( camera, parent );
  */

renderer.setClearColor(0xffffff, 1);

/* // Callback-style rendering (Orbit controls)
// function to redraw the scene
this.renderCallback = function() {
  console.log("rendering");
  renderer.render(scene, camera);
};

// attach an event listener to only render on change
controls.addEventListener('change', this.renderCallback);

// start rendering
this.renderCallback();
*/

 // animation loop style rendering (Trackball controls)
  function renderLoop() {
    // TK check if camera has changed and
    // TK skip rendering if it's the same
    controls.update();
    renderer.render(scene, camera);
    
   // reduce cpu use by limiting to 50 fps
   // can do better by only rendering when updated
   setTimeout(function() {
     requestAnimationFrame(renderLoop); // only render when browser says so

   }, fps);

    //requestAnimationFrame(render); // And repeat...
  }
 
  renderLoop(); //start rendering loop


  // Fix coordinates up if window is resized.
  $(window).on("resize", function() {
  	width = $parent.innerWidth();
	  height = $parent.innerHeight();
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    
    controls.screen.width = width;
    controls.screen.height = height;
    console.log("gcode scene resized");
  });
  console.log("gcode scene created");
  return scene;
}
