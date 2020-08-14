/*global define*/
define([
	"esri/layers/ArcGISTiledMapServiceLayer",
	"esri/layers/ArcGISDynamicMapServiceLayer",
	"esri/layers/FeatureLayer"
], function (ArcGISTiledMapServiceLayer, ArcGISDynamicMapServiceLayer, FeatureLayer) {

	function createLayerList(map, layerDefinitions) {
		/** Creates the layer options div.
		* @param {esri/layers/Layer} layer
		* @returns {HTMLDivElement}
		*/
		function createLayerOptions(layer) {

			/*
			<div class="layer-options">
				<label>opacity</label> <input type="range" min="0" max="1" step="0.1" value="1" />
			</div>
				*/
			var div = document.createElement("div");
			div.classList.add("layer-options");
			div.classList.add("well");
			var label = document.createElement("label");
			label.textContent = "Opacity";
			var slider = document.createElement("input");
			slider.type = "range";
			slider.min = 0;
			slider.max = 1;
			slider.step = 0.1;
			slider.value = layer.opacity;
			div.appendChild(label);
			div.appendChild(slider);

			slider.onchange = function () {
				layer.setOpacity(slider.value);
			};

			return div;
		}

		/**
			* Creates the link to toggle the layer options div's visiblitly.
			* @param {HTMLDivElement} optionsDiv - The div that will have it's visibility controlled by this link.
			* @returns {HTMLAnchorElement}
			*/
		function createOptionsToggleLink(optionsDiv) {
			var link, span;
			if (!optionsDiv) {
				throw new TypeError("Options div was not provided.");
			}
			link = document.createElement("a");
			link.href = "#";
			span = document.createElement("span");
			span.classList.add("glyphicon");
			span.classList.add("glyphicon-chevron-up");
			link.appendChild(span);

			link.onclick = function () {
				if (span.classList.contains("glyphicon-chevron-up")) {
					span.classList.remove("glyphicon-chevron-up");
					span.classList.add("glyphicon-chevron-down");
					optionsDiv.classList.add("hidden");
				} else {
					span.classList.remove("glyphicon-chevron-down");
					span.classList.add("glyphicon-chevron-up");
					optionsDiv.classList.remove("hidden");
				}
				return false;
			};

			return link;
		}

		/** Applies the `checked` value of the current checkbox
			* to nested checkboxes.
			* @param {Event} e
			*/
		function checkNestedCheckboxes(e) {
			// Get the checkbox that triggered the event.
			// li > label > input[type='checkbox']
			var currentCheckbox = e.currentTarget;
			// Get the list item that hosts the checkbox.
			var listItem = currentCheckbox.parentElement.parentElement;
			// Get a NodeList of child checkboxes.
			// li > ul > li input[type='checkbox']
			var subCheckboxes = listItem.querySelectorAll("ul > li input[type='checkbox']");

			for (var i = 0, l = subCheckboxes.length; i < l; i += 1) {
				subCheckboxes[i].checked = currentCheckbox.checked;
			}

		}

		function createListItem(layerInfos, id) {
			var layerInfo = layerInfos[id], li, ul, hasSublayers;
			hasSublayers = layerInfo.subLayerIds && layerInfo.subLayerIds.length;
			// Create the output list item.
			li = document.createElement("li");
			// Add class for bootstrap styling.
			li.classList.add("list-group-item");
			// Add sublayer lists.
			// Set data-has-sublayers.
			if (hasSublayers) {
				ul = document.createElement("ul");
				// Add class for bootstrap styling.
				ul.classList.add("list-group");
				// For each child layer id, make a recursive call to this function.
				layerInfo.subLayerIds.forEach(function (layerId) {
					var subli = createListItem(layerInfos, layerId);
					ul.appendChild(subli);
				});
			}
			var label = document.createElement("label");
			var checkbox = document.createElement("input");
			checkbox.type = "checkbox";
			checkbox.checked = layerInfo.defaultVisibility;
			checkbox.value = id;
			//checkbox.dataset.subLayerIds = layerInfo.subLayerIds ? layerInfo.subLayerIds.join(",") : "";
			checkbox.setAttribute("data-sub-layer-ids", layerInfo.subLayerIds ? layerInfo.subLayerIds.join(",") : "");
			//checkbox.dataset.parentLayerId = layerInfo.parentLayerId === -1 ? "" : layerInfo.parentLayerId;
			checkbox.setAttribute("data-parent-layer-id",  layerInfo.parentLayerId === -1 ? "" : layerInfo.parentLayerId);
			if (hasSublayers) {
				checkbox.onchange = checkNestedCheckboxes;
			}
			label.appendChild(checkbox);
			// label.textContent = layerInfo.name;
			var labelText = document.createElement("span");
			labelText.textContent = layerInfo.name;
			label.appendChild(labelText);
			li.appendChild(label);
			if (ul) {
				li.appendChild(ul);
			}
			return li;
		}

		/**
			* Creates a div with sublayer list.
			* @param {esri/layers/Layer} layer
			* @returns {HTMLDivElement}
			*/
		function createSublayerDiv(layer) {
			var div = null, ul, applyButton;

			if (layer.setVisibleLayers && layer.layerInfos && layer.layerInfos.length > 1) {
				div = document.createElement("div");
				div.setAttribute("class", "well sublayer-list");
				ul = document.createElement("ul");
				ul.classList.add("list-group");

				layer.layerInfos.forEach(function (layerInfo) {
					/*jshint eqnull:true*/
					if (layerInfo.parentLayerId < 0) {
						ul.appendChild(createListItem(layer.layerInfos, layerInfo.id));
					}
					/*jshint eqnull:false*/
				});
				div.appendChild(ul);
				applyButton = document.createElement("button");
				applyButton.type = "button";
				applyButton.appendChild(document.createTextNode("Apply"));
				applyButton.classList.add("btn");
				applyButton.classList.add("btn-primary");
				div.appendChild(applyButton);

				applyButton.onclick = function () {
					// Select all checked checkboxes without a sublayer ID.
					////var checkboxes = ul.querySelectorAll("input[data-sub-layer-ids='']:checked");
					var checkboxes = ul.querySelectorAll("input[type='checkbox']:checked");
					// Get the sublayer IDs.
					var sublayers = [];
					for (var i = 0, l = checkboxes.length; i < l; i += 1) {
						sublayers.push(parseInt(checkboxes[i].value, 10));
					}
					// If the list of sublayer IDs is empty, add -1.
					// This is how you indicate "no sublayers".
					if (sublayers.length < 1) {
						sublayers.push(-1);
					}
					layer.setVisibleLayers(sublayers);
				};
			}

			return div;
		}

		/** Toggles a layers visibility.
			* The first time the checkbox is checked, the corresponding layer will be created and added to the map.
			* @param {Event} e
			* @this {HTMLInputElement} - The clicked checkbox.
			*/
		function toggleLayer(e) {
			var checkbox, layerId, layer, listItem, checkboxLabel, progress;
			checkbox = e.target || e.currentTarget;
			checkboxLabel = checkbox.parentElement;
			// Get the li that contains the checkbox.
			listItem = checkboxLabel.parentElement;

			layerId = checkbox.getAttribute("data-layer-id"); //checkbox.dataset.layerId;
			layer = map.getLayer(layerId);
			if (layer) {
				if (checkbox.checked) {
					layer.show();
				} else {
					layer.hide();
				}
			} else {
				if (checkbox.checked) {
					// Create the layer and add it to the map.

					progress = document.createElement("progress");
					checkbox.disabled = true;
					listItem.appendChild(progress);
					
					////if (checkbox.dataset.layerType === "ArcGISTiledMapServiceLayer") {
					////	layer = new ArcGISTiledMapServiceLayer(checkbox.dataset.url, {
					////		id: checkbox.dataset.layerId
					////	});
					////} else if (checkbox.dataset.layerType === "ArcGISDynamicMapServiceLayer") {
					////	layer = new ArcGISDynamicMapServiceLayer(checkbox.dataset.url, {
					////		id: checkbox.dataset.layerId
					////	});
					////}

					if (checkbox.getAttribute("data-layer-type") === "ArcGISTiledMapServiceLayer") {
						layer = new ArcGISTiledMapServiceLayer(checkbox.getAttribute("data-url"), {
							id: checkbox.getAttribute("data-layer-id")
						});
					} else if (checkbox.getAttribute("data-layer-type") === "ArcGISDynamicMapServiceLayer") {
						layer = new ArcGISDynamicMapServiceLayer(checkbox.getAttribute("data-url"), {
							id: checkbox.getAttribute("data-layer-id")
						});
					} else if (checkbox.dataset.layerType === "FeatureLayer") {
						layer = new FeatureLayer(checkbox.dataset.url, {
							id: checkbox.dataset.layerId
						});
					}
					
					if (layer) {
						map.addLayer(layer);
						layer.on("load", function () {
							checkbox.disabled = false;
							listItem.removeChild(progress);
							// Add the layer options section.
							var optionsDiv, link, sublayerLabel, sublayerDiv;
							optionsDiv = createLayerOptions(layer);
							link = createOptionsToggleLink(optionsDiv);
							checkboxLabel.appendChild(document.createTextNode(" "));
							checkboxLabel.appendChild(link);
							sublayerDiv = createSublayerDiv(layer);
							if (sublayerDiv) {
								sublayerLabel = document.createElement("label");
								sublayerLabel.innerText = "Sublayers";
								optionsDiv.appendChild(sublayerLabel);
								optionsDiv.appendChild(sublayerDiv);
							}
							listItem.appendChild(optionsDiv);
						});
						layer.on("error", function (error) {
							console.error(error);
						});
					}
				}
			}
		}

		function createLayerListDiv(layerDefinitions) {
			var outputDiv, listGroupUL;

			function createListItem(layerDef) {
				var li, label, input, textNode;
				li = document.createElement("li");
				li.classList.add("list-group-item");
				label = document.createElement("label");
				li.appendChild(label);
				input = document.createElement("input");
				input.type = "checkbox";
				////input.dataset.url = layerDef.url;
				////input.dataset.layerType = layerDef.type;
				////input.dataset.layerId = layerDef.id;

				input.setAttribute("data-url", layerDef.url);
				input.setAttribute("data-layer-type", layerDef.type);
				input.setAttribute("data-layer-id", layerDef.id);

				if (layerDef.visibility) {
					////input.dataset.defaultVisibility = layerDef.visibility;
					input.setAttribute("data-default-visibility", layerDef.visibility);
				}
				label.appendChild(input);
				textNode = document.createTextNode(layerDef.title || layerDef.id);
				label.appendChild(textNode);
				return li;
			}

			if (!(layerDefinitions && layerDefinitions.length)) {
				throw TypeError("layerDefinitions not provided.");
			}

			// Create the outer container.
			outputDiv = document.createElement("div");
			// Create the list of layers.
			listGroupUL = document.createElement("ul");
			listGroupUL.setAttribute("class", "list-group");
			outputDiv.appendChild(listGroupUL);
			// Add the list items.
			layerDefinitions.forEach(function (layerDef) {
				var li = createListItem(layerDef);
				listGroupUL.appendChild(li);
			});

			return outputDiv;
		}

		var layerListDiv = createLayerListDiv(layerDefinitions), checkboxes, checkbox;

		checkboxes = layerListDiv.querySelectorAll("[type='checkbox']");
		// Attach click event handler to checkboxes.
		for (var i = 0, l = checkboxes.length; i < l; i += 1) {
			checkbox = checkboxes[i];
			checkbox.addEventListener("click", toggleLayer, true);
		}
		
		return layerListDiv;
	}

	return {
		createLayerList: createLayerList
	};
});