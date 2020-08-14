/*global define*/
define([
	"dojo/promise/all",
	"dojo/Deferred",
	"esri/request",
	"esri/tasks/IdentifyTask",
	"esri/tasks/IdentifyParameters",
	"esri/InfoTemplate"
], function (all, Deferred, esriRequest, IdentifyTask, IdentifyParameters, InfoTemplate) {

	/**
	 * A module that creates MapIdentifyTasks.
	 * @module MapIdentifyTask
	 */

	/**
	 * @external Deferred
	 * @see {@link http://dojotoolkit.org/reference-guide/dojo/Deferred.html Deferred}
	 */

	/**
	 * @external Geometry
	 * @see {@link https://developers.arcgis.com/javascript/jsapi/geometry-amd.html Geometry}
	 */

	/**
	 * @external Graphic
	 * @see {@link https://developers.arcgis.com/javascript/jsapi/graphic-amd.html Graphic}
	 */

	/**
	 * @external IdentifyParameters
	 * @see {@link https://developers.arcgis.com/javascript/jsapi/identifyparameters-amd.html IdentifyParameters}
	 */

	/**
	 * @external IdentifyTask
	 * @see {@link https://developers.arcgis.com/javascript/jsapi/identifytask-amd.html IdentifyTask}
	 */

	/**
	 * @external Layer
	 * @see {@link https://developers.arcgis.com/javascript/jsapi/layer-amd.html Layer}
	 */

	/**
	 * @external Map
	 * @see {@link https://developers.arcgis.com/javascript/jsapi/map-amd.html Map}
	 */


	// Matches a map service or map service layer URL.
	// Match results: [full-match, map-server-url, layer-id or undefined]
	var serverUrlRe = /((?:https?\:)?\/\/.+\/(?:(?:Map)|(?:Feature))Server)(?:\/(\d+))?/;

	/**
	 * A task that will execute multiple IdentifyTasks for the layers in a map.
	 * @constructor
	 * @param {external:Map} map
	 * @param {number} [tolerance=5]
	 * @param {RegExp} [ignoredUrls=null] - Any map services with URLs that match this RegExp will not participate in the map's Identify operation.
	 */
	function MapIdentifyTask(map, tolerance, ignoredUrls) {
		/** @member {external:Map} */
		this.map = map;
		/** @member {number} */
		this.tolerance = typeof tolerance === "number" ? tolerance : 5;
		/** @member {Object.<string, TaskIdPair>} */
		this._tasks = {};
		/** @member {RegExp} */
		this.ignoredUrls = ignoredUrls || null;
		////this._htmlPopupTypes = {};
	}

	/**
	 * A pair of task and optional layer ID. A layer ID will only be present for layer types where 
	 * that would be applicable (e.g., FeatureLayer but not ArcGISDynamicMapServiceLayer).
	 * @constructor
	 * @param {external:IdentifyTask} task
	 * @param {?number} [id] - Only certain layer types (e.g., FeatureLayer) will have an ID value.
	 */
	function TaskIdPair(task, id) {
		/** @member {external:IdentifyTask} */
		this.task = task;
		/** @member {?number} */
		this.id = typeof id !== "number" ? null : id;
	}

	/**
	 * Creates either an Identify or Query task. The type of task depends on the input layer type.
	 * @param {external:Layer} layer
	 * @returns {TaskIdPair}
	 */
	function createIdentifyTaskForLayer(layer) {
		var task, id, match, output;
		if (layer.url) {
			match = layer.url.match(serverUrlRe);
			if (match) {
				task = new IdentifyTask(match[1]);
				if (match[2]) {
					id = Number(match[2]);
				}
				output = new TaskIdPair(task, id);
			} else {
				throw new Error("layer does not have a valid URL");
			}
		}
		return output;
	}

	// TODO: Check to see if layers actually SUPPORT identify.
	// TODO: Use services' HTML popups if they have them.

	////function requestLayerInfo(layer) {
	////	var deferred = new Deferred();
	////	var url = typeof layer === "string" ? layer : layer.url || null;
	////	if (!url) {
	////		deferred.reject({ message: "Could not deterine URL", layer: layer });
	////	}
	////	if (urlIsMapServerLayer(layer.url)) {
	////		esriRequest({
	////			url: layer.url,
	////			content: {
	////				f: "json"
	////			}
	////		}).then(function (response) {
	////			deferred = response;
	////		});
	////	} else if (urlIsMapServer(layer.url)) {
	////		// TODO: Query all non-group sublayers.
	////		throw new Error("Not implemented");
	////	}

	////	return deferred;
	////}

	////MapIdentifyTask.prototype.getHtmlPopupTypeForLayer = function (layer) {
	////	var deferred;
	////	if (this._htmlPopupTypes[layer.id]) {
	////		deferred = new Deferred();
	////		deferred.resolve(this._htmlPopupTypes[layer.id]);
	////	} else {
	////		deferred = requestHtmlPopupType(layer);
	////	}

	////	return deferred;
	////};

	/**
	 * Gets a task for the specified layer. If corresponding task does not yet exist,
	 * it will be created.
	 * @param {external:Layer} layer
	 * @returns {TaskIdPair}
	 */
	MapIdentifyTask.prototype._getTaskForLayer = function (layer) {
		var task;
		// Create an identify task for this layer if it does not already exist.
		if (!this._tasks.hasOwnProperty(layer.id)) {
			task = createIdentifyTaskForLayer(layer);
			if (task) {
				// Store the task.
				this._tasks[layer.id] = task;
			}
		}

		return this._tasks[layer.id];
	};

	/**
	 * Creates identify parameters for a given map service layer and geometry.
	 * @param {external:Layer} layer
	 * @param {external:Geometry} geometry
	 * @param {number} [id] - For feature layers, sublayer ID.
	 * @returns {external:IdentifyParameters}
	 */
	MapIdentifyTask.prototype.createIdentifyParametersForLayer = function (layer, geometry, id) {
		var parameters = new IdentifyParameters();
		parameters.layerOption = IdentifyParameters.LAYER_OPTION_VISIBLE;
		parameters.returnGeometry = true;
		parameters.tolerance = this.tolerance;
		// Set propetries of map.
		parameters.mapExtent = this.map.extent;
		parameters.width = this.map.width;
		parameters.height = this.map.height;
		parameters.geometry = geometry;
		if (typeof id === "number") {
			parameters.layerIds = [id];
		}
		return parameters;
	};

	/**
	 * Runs the corresponding Identify task for a map service layer.
	 * @param {external:Layer} layer
	 * @param {external:Geometry} geometry
	 * @returns {external:Deferred}
	 */
	MapIdentifyTask.prototype._identifyForLayer = function (layer, geometry) {
		var taskIdPair = this._getTaskForLayer(layer);
		var task, idParams, output;
		if (taskIdPair) {
			task = taskIdPair.task;
			idParams = this.createIdentifyParametersForLayer(layer, geometry, taskIdPair.id);
			output = task.execute(idParams);
		}
		return output || null;
	};

	/**
	 * @typedef {Object.<string, external:Deferred>} MapIdentifyResults
	 * The property names correspond to the layer ids of layers in the map.
	 * The Deferred value is the result of an Identify task.
	 */

	/**
	 * Runs an Identify operation on all visible layers in the map.
	 * @returns {MapIdentifyResults}
	 */
	MapIdentifyTask.prototype.identify = function (geometry) {
		var output = {};
		// Note that "visible" according to getLayersVisibleAtScale does not check to see if the visible
		// property is set to true or false. This will be checked in the loop later.
		var visibleLayers = this.map.getLayersVisibleAtScale(); 
		var self = this;

		visibleLayers.forEach(function (layer) {
			var def;
			if (layer.visible && (!self.ignoredUrls || !self.ignoredUrls.test(layer.url))) {
				def = self._identifyForLayer(layer, geometry);
				if (def) {
					output[layer.id] = def;
				}
			}
		});


		return all(output);
	};


	/**
	 * Creates an HTML table of a graphic's attributes. Intended for use as an InfoTemplate's content generation function.
	 * @param {external:Graphic} graphic
	 * @returns {string}
	 */
	function createTableFromGraphic(graphic) {
		var output = ["<table>"];
		for (var name in graphic.attributes) {
			if (graphic.attributes.hasOwnProperty(name)) {
				output.push("<tr><th>", name, "</th><td>", graphic.attributes[name], "</td></tr>");
			}
		}
		output.push("</table>");
		return output.join("");
	}

	var defaultInfoTemplate = new InfoTemplate();
	defaultInfoTemplate.setContent(createTableFromGraphic);
	MapIdentifyTask.defaultInfoTemplate = defaultInfoTemplate;

	/**
	 * Extracts the feature portion of an identify result. Intended for use with the Array.prototype.map function.
	 * @param {IdentifyResult} idResult
	 * @returns {external:Graphic}
	 */
	function getFeatureFromIdResult(idResult) {
		var feature = null;
		if (idResult && idResult.feature) {
			feature = idResult.feature;
			if (!feature.infoTemplate) {
				feature.infoTemplate = defaultInfoTemplate;
			}
		}
		return feature;
	}


	/**
	 * Converts the results of MapIdentifyTask.identify into an array of graphics.
	 * @param {MapIdentifyResults} results
	 * @returns {external:Graphic[]}
	 */
	MapIdentifyTask.resultsToGraphics = function (results) {
		var idResultsArray, output;
		for (var layerName in results) {
			if (results.hasOwnProperty(layerName)) {
				idResultsArray = results[layerName];
				idResultsArray = idResultsArray.map(getFeatureFromIdResult);
				output = output ? output.concat(idResultsArray) : idResultsArray;
			}
		}
		return output || null;
	};

	return MapIdentifyTask;
});