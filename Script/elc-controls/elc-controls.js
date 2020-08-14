/*global define*/
define([
	"esri/graphic",
	"esri/geometry/jsonUtils",
	"esri/layers/GraphicsLayer",
	"esri/renderers/SimpleRenderer",
	"esri/symbols/SimpleMarkerSymbol",
	"esri/InfoTemplate",
	"esri/toolbars/draw",
	"elc",
	"dojo/text!./template.html"
], function (Graphic, geometryJsonUtils, GraphicsLayer, SimpleRenderer, SimpleMarkerSymbol, InfoTemplate, Draw, Elc, template) {
	"use strict";


	/** Converts an object into a definition list.
	 * @param {(Graphic|Object)} obj
	 * @returns {HTMLDListElement}
	 */
	function objectToDL(obj) {
		var dl, dt, dd;

		if (obj.attributes) {
			obj = obj.attributes;
		}

		dl = document.createElement("dl");
		
		for (var name in obj) {
			if (obj.hasOwnProperty(name)) {
				dt = document.createElement("dt");
				dt.textContent = name;
				dl.appendChild(dt);
				dd = document.createElement("dd");
				dd.textContent = String(obj[name]);
				dl.appendChild(dd);
			}
		}

		return dl;
	}

	function routeLocationToAttributes(routeLocation, ignoredRe) {
		var output = {}, val, timeRe = /T.+$/, acReturnCodeRe = /ArmCalcReturnCode$/i;
		if (ignoredRe === undefined) {
			ignoredRe = /^(?:(?:RouteGeometry)|(?:(?:End)?Back))$/i;
		}
		for (var propName in routeLocation) {
			if (routeLocation.hasOwnProperty(propName)) {
				val = routeLocation[propName];
				if (typeof val === "string") {
					val = val.trim();
				}
				/*jshint eqnull:true*/
				if (!ignoredRe.test(propName) && (val === 0 || !!val) && !(acReturnCodeRe.test(propName) && val === 0)) {
					if (propName === "Srmp") {
						val = [val, routeLocation.Back ? "B" : ""].join("");
					} else if (propName === "EndSrmp") {
						val = [val, routeLocation.EndBack ? "B" : ""].join("");
					}
					if (val.toISOString) {
						val = val.toISOString().replace(timeRe,"");
					}
					output[propName] = val;
				}
				/*jshint eqnull:false*/
			}
		}
		return output;
	}

	function routeLocationToGraphic(routeLocation) {
		var graphic = null, geometry;
		if (routeLocation) {
			geometry = !!routeLocation.RouteGeometry ? geometryJsonUtils.fromJson(routeLocation.RouteGeometry) : null;
			graphic = new Graphic(geometry, null, routeLocationToAttributes(routeLocation));
		}
		return graphic;
	}

	// Setup ELC controls
	function ElcControls(containerElement, map) {
		var elc, pointsLayer, linesLayer, findRouteLocationForm, mpTypeRadios, gTypeRadios, draw;

		if (typeof containerElement === "string") {
			containerElement = document.getElementById(containerElement);
		}
		if (!containerElement) {
			throw new TypeError("Invalid containerElement parameter");
		}
		// Add the template to the containerElement.
		containerElement.innerHTML = template;

		elc = new Elc.RouteLocator();
		findRouteLocationForm = document.forms.findRouteLocation;

		mpTypeRadios = findRouteLocationForm["mp-type"];
		gTypeRadios = findRouteLocationForm["geometry-type"];

		/**
		 * @param {Object} results
		 * @param {Point} results.geometry
		 * @param {Point} results.geographicGeometry
		 */
		function findNearestRouteOnDrawComplete(results) {
			var radius = Number(document.getElementById("find-nearest-search-radius").getAttribute("value"));
			draw.deactivate();
			elc.findNearestRouteLocations({
				useCors: true,
				coordinates: [results.geometry.x, results.geometry.y],
				referenceDate: new Date(),
				searchRadius: radius,
				inSR: results.geometry.spatialReference.wkid,
				outSR: map.spatialReference.wkid,
				successHandler: function (routeLocations) {
					if (routeLocations && routeLocations.length) {
						addResultToMap(routeLocations);
					} else {
						// Show info window at clicked location with "no routeLocations" message.
						map.infoWindow.clearFeatures();
						map.infoWindow.setTitle("No nearby route locations");
						map.infoWindow.setContent(["No route locations were found within a radius of ", radius, "'."].join(""));
						map.infoWindow.show(results.geometry);
					}
				},
				errorHandler: function (error) {
					console.error(error);
					alert("An error occured attempting to locate the nearest route location. See browser console for details.");
				}
			});
		}

		// Create the draw toolbar if it does not already exist.
		draw = new Draw(map, {
			showTooltips: true
		});
		draw.on("draw-complete", findNearestRouteOnDrawComplete);

		/**
		 * Clears all graphics from the graphics layers.
		 */
		function clearElcGraphics() {
			[pointsLayer, linesLayer].forEach(function (layer) {
				if (layer && layer.clear()) {
					layer.clear();
				}
			});
		}

		document.getElementById("clearElcGraphicsButton").onclick = clearElcGraphics;

		// Set default date
		(function (dateBox) {
			/**
			 * Converts number to string, padding with leading zero if less than two characters long.
			 * @param {number} n
			 * @returns {string}
			 */
			function addLeadingZeroes(n) {
				n = String(n);
				if (n.length < 2) {
					n = "0" + n;
				}
				return n;
			}

			/**
			 * Converts a Date object into the string format used by an <input type="date"> element.
			 * @param {Date} date
			 * @returns {string}
			 */
			function dateToDateInputValueFormat(date) {
				return [date.getFullYear(), addLeadingZeroes(date.getMonth() + 1), addLeadingZeroes(date.getDate())].join("-");
			}

			var date = new Date();
			if (dateBox) {
				dateBox.setAttribute("value", dateToDateInputValueFormat(date));
			}
		}(document.querySelector("[name='reference-date']")));

		// Setup the layers.
		(function () {
			var pointRenderer, pointSymbol, infoTemplate;

			infoTemplate = new InfoTemplate("Route Location", objectToDL);

			pointsLayer = new GraphicsLayer({
				id: "elcPoints",
				infoTemplate: infoTemplate
			});

			pointSymbol = new SimpleMarkerSymbol().setColor("green");
			pointRenderer = new SimpleRenderer(pointSymbol);
			pointsLayer.setRenderer(pointRenderer);

			linesLayer = new GraphicsLayer({
				id: "elcLines",
				infoTemplate: infoTemplate,
				className: "elc-lines",
				styling: false
			});

			map.addLayers([pointsLayer, linesLayer]);
		}());

		/**
		 * Add route location results to the map.
		 * @param {RouteLocation[]} routeLocations
		 */
		function addResultToMap(routeLocations) {
			var graphic;
			for (var i = 0; i < routeLocations.length; i++) {
				graphic = routeLocationToGraphic(routeLocations[i]);
				if (graphic && graphic.geometry) {
					if (graphic.geometry.x) {
						pointsLayer.add(graphic);
					} else {
						linesLayer.add(graphic);
					}
				}
			}

			/**
			 * Opens the popup for the geometry.
			 */
			function activatePopup() {
				var geometry = graphic.geometry, infoWindow = map.infoWindow;
				// If the geometry is not a point, get the center point.
				if (!geometry.x && geometry.getExtent) {
					geometry = geometry.getExtent().getCenter();
				}
				infoWindow.setFeatures([graphic]);
				infoWindow.show(geometry);
				
			}

			if (!!graphic.geometry.x) {
				map.centerAndZoom(graphic.geometry, 12).then(activatePopup);
			} else if (!!graphic.geometry.getExtent) {
				map.setExtent(graphic.geometry.getExtent()).then(activatePopup);
			}
		}

		/**
		 * Adds or removes the "mp-type-arm" class to the form based on the value of the ARM / SRMP radio buttons.
		 */
		function setFormMPType() {
			var mpType = findRouteLocationForm.querySelector("[name='mp-type']:checked").value;
			var mpClass = "mp-type-arm";
			if (mpType === "ARM") {
				findRouteLocationForm.classList.add(mpClass);
			} else {
				findRouteLocationForm.classList.remove(mpClass);
			}
		}

		/**
		 * Adds or removes the "geometry-type-point" class to the form based on the which geometry type radio button is checked.
		 */
		function setGeometryType() {
			var gType = findRouteLocationForm.querySelector("[name='geometry-type']:checked").value;
			var gClass = "geometry-type-point";
			if (gType === "point") {
				findRouteLocationForm.classList.add(gClass);
			} else {
				findRouteLocationForm.classList.remove(gClass);
			}
		}

		// Populates the route suggestion list for the input box.
		elc.getRouteList(function (routeList) {
			var routeListElement, docFrag;
			if (routeList && routeList.Current && routeList.Current.length) {
				routeListElement = document.getElementById("routeList");
				docFrag = document.createDocumentFragment();
				routeList.Current.forEach(function (/**{Elc.Route}*/ route) {
					var option = document.createElement("option");
					option.value = route.name;
					docFrag.appendChild(option);
				});
				routeListElement.appendChild(docFrag);
			}
		}, function (error) {
			console.error("Error loading route list", error);
		}, true);

		setFormMPType();
		setGeometryType();

		// Setup click events for radio buttons.
		var i, l;

		for (i = 0, l = mpTypeRadios.length; i < l; i += 1) {
			mpTypeRadios[i].onchange = setFormMPType;
		}

		for (i = 0, l = gTypeRadios.length; i < l; i += 1) {
			gTypeRadios[i].onchange = setGeometryType;
		}

		findRouteLocationForm.onsubmit = function () {

			var routeLocation, mpType, form = this, milepost, gType, endMP, isSrmp;

			mpType = form["mp-type"].value;
			gType = form["geometry-type"].value;
			milepost = parseFloat(form.milepost.value);
			isSrmp = mpType === "SRMP";

			routeLocation = new Elc.RouteLocation({
				Route: form.route.value,
				Arm: !isSrmp ? milepost : null,
				Srmp: isSrmp ? milepost : null,
				Back: isSrmp ? form["is-back"].checked : null
			});

			if (gType === "line") {
				endMP = parseFloat(form["end-milepost"].value);
				if (isSrmp) {
					routeLocation.EndSrmp = endMP;
					routeLocation.EndBack = form["end-is-back"].checked;
				} else {
					routeLocation.EndArm = endMP;
				}
			}

			var rlParams = {
				locations: [routeLocation],
				referenceDate: form["reference-date"].value,
				outSR: map.spatialReference.wkid,
				successHandler: function (/**{Elc.RouteLocation[]}*/ routeLocations) {
					addResultToMap(routeLocations);
				},
				errorHandler: function (error) {
					console.error(error);
				},
				useCors: true
			};

			elc.findRouteLocations(rlParams);

			// Return false to prevent the page from reloading.
			return false;
		};

		// Add an event handler for reset.
		// Must programatically "click" the unchecked default radio buttons. Otherwise user will have to click "Reset" button twice.
		findRouteLocationForm.addEventListener("reset", function () {
			var defaultRadios = this.querySelectorAll("[value='SRMP']:not(:checked),[value='point']:not(:checked)");
			for (var i = 0, l = defaultRadios.length; i < l; i += 1) {
				defaultRadios[i].click();
			}
		});

		document.getElementById("findNearestDrawButton").onclick = function () {
			draw.activate(Draw.POINT);
		};
	}

	return ElcControls;
});