
# MillMeister

**MillMeister.io** is a javascript tool path generator designed for microfluidics. 
It parses a dxf file, automatically detects milling parameters based on layer names, generates the tool paths, and stores them in a gcode (*.nc) file.
The gcode is parsed and rendered as a 3D model using three.js.
 
#### Usage
* Load DXF
* Check process parameters
* Export gcode and job info

#### To Run Online
Visit https://huilab.github.io/millmeister/

#### To Run Locally
* Clone the repo
* In the file startserver.py, uncomment and check the path to your preferred browser
```
> cd millmeister
> python startserver.py
# start a server on localhost:8000 and open MillMeister.io in your favorite browser
````
#### Makes use of
* https://github.com/gdsestimating/three-dxf
* https://github.com/gdsestimating/dxf-parser
* Z-adjust feature based off an AutoLisp script first described 
in [Scaling of pneumatic digital logic circuits] DOI: 10.1039/C4LC01048E written by Phil Duncan 

[Scaling of pneumatic digital logic circuits]: https://doi.org/10.1039/C4LC01048E

#### Todo
* Reduce movement: http://parano.github.io/GeneticAlgorithm-TSP/

#### Contributors
ewerner@uci.edu
