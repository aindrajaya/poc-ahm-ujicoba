/*global define*/
(function (root, factory) {
	if (typeof define === 'function' && define.amd) {
		// AMD. Register as an anonymous module.
		define([], factory);
	} else {
		// Browser globals
		root.amdWeb = factory();
	}
}(this, function () {

	/**
	 * Checks the document to see if a given id already exists in the document.
	 * If the id already exists, the output will be the input id with a number 
	 * appended to it to make it unique. Otherwise the original id will be returned.
	 * @param {string} id
	 * @returns {string}
	 */
	function ensureUniqueId(id) {
		var existingElement = document.getElementById(id), newId, i = 0;
		if (!existingElement) {
			return id;
		}
		while (existingElement) {
			newId = id + i;
			existingElement = document.getElementById(newId);
		}
		return newId;
	}

	/**
	 * Creates a form 
	 * @param {string} printTaskUrl - URL to the print task.
	 */
	function PrintUI(printTaskUrl) {
		var form, submitButton, templateSelect, resultsList;

		function populateSelectBoxes() {
			var request = new XMLHttpRequest();
			request.open("get", printTaskUrl + "?f=json");
			request.responseType = "json";
			request.onloadend = function () {
				var svcInfo = this.response, parameters, formats, templates, param;

				/**
				 * @param {HTMLSelectElement} select
				 * @param {string[]} strings
				 */
				function addStringsAsOptionsToSelectBox(select, strings) {
					var dFrag;

					if (!select) {
						throw new TypeError("select not provided or invalid.");
					}

					dFrag = document.createDocumentFragment();
					strings.forEach(function (f) {
						var option = document.createElement("option");
						option.value = f;
						option.textContent = f;
						dFrag.appendChild(option);
					});
					select.appendChild(dFrag);
				}

				if (typeof svcInfo === "string") {
					svcInfo = JSON.parse(svcInfo);
				}
				parameters = svcInfo.parameters;

				for (var i = 0, l = parameters.length; i < l; i += 1) {
					if (!!templates && !!formats) {
						break;
					}

					param = parameters[i];
					if (param.name === "Format") {
						formats = param.choiceList;
					} else if (param.name === "Layout_Template") {
						templates = param.choiceList;
					}
				}

				// Add the options to the select boxes
				addStringsAsOptionsToSelectBox(form[0], templates);
			};
			request.send();
		}

		printTaskUrl = printTaskUrl || "http://www.wsdot.wa.gov/geoservices/ArcGIS/rest/services/Utilities/PrintingTools/GPServer/Export%20Web%20Map%20Task";

		function createSelectGroup(id, labelText, name, options) {
			var div, label, selectElement, dFrag;
			div = document.createElement("div");
			div.classList.add("form-group");
			form.appendChild(div);
			id = ensureUniqueId(id);
			label = document.createElement("label");
			label.htmlFor = id;
			label.textContent = labelText;
			div.appendChild(label);
			selectElement = document.createElement("select");
			selectElement.id = id;
			selectElement.classList.add("form-control");
			selectElement.name = name;
			div.appendChild(selectElement);

			if (options) {
				dFrag = document.createDocumentFragment();
				options.forEach(function (f) {
					var option = document.createElement("option");
					option.value = f;
					option.textContent = f;
					dFrag.appendChild(option);
				});

				selectElement.appendChild(dFrag);
			}
			return div;
		}

		function createTextBoxGroup(id, labelText, name, placeholder) {
			var div, label, textBox;
			div = document.createElement("div");
			div.classList.add("form-group");
			form.appendChild(div);
			id = ensureUniqueId(id);
			label = document.createElement("label");
			label.textContent = labelText;
			label.htmlFor = id;
			div.appendChild(label);
			textBox = document.createElement("input");
			textBox.classList.add("form-control");
			textBox.id = id;
			textBox.name = name;
			if (placeholder) {
				textBox.placeholder = placeholder;
			}
			div.appendChild(textBox);
			return div;
		}

		form = document.createElement("form");
		form.setAttribute("role", "form");
		form.action = printTaskUrl;

		// Template selector.
		templateSelect = createSelectGroup("templateSelect", "Template", "template");
		form.appendChild(templateSelect);

		// Author text box
		form.appendChild(createTextBoxGroup("authorText", "Author", "author", "Enter author name here"));
		// Create title text box
		form.appendChild(createTextBoxGroup("titleText", "Title", "title", "Enter title here"));

		// Create scalebar unit select.
		form.appendChild(createSelectGroup("scalebarUnitSelect", "Scalebar Unit", "scalebar-unit", ["Miles", "Kilometers", "Feet", "Meters"]));

		submitButton = document.createElement("button");
		submitButton.type = "submit";
		submitButton.innerHTML = "<span class='glyphicon glyphicon-print'></span> Print";
		submitButton.setAttribute("class", "btn btn-default");

		form.appendChild(submitButton);

		// Load data to populate select boxes.
		populateSelectBoxes();

		resultsList = document.createElement("ul");
		resultsList.classList.add("print-ui-results-list");
		resultsList.classList.add("list-group");

		this.form = form;
		this.resultsList = resultsList;
		this.submitButton = submitButton;
	}

	PrintUI.prototype.addResult = function (url, label) {
		var li, a, span;
		label = label || "Printout";
		li = document.createElement("li");
		li.classList.add("print-ui-results-list-item");
		li.classList.add("list-group-item");

		a = document.createElement("a");
		a.href = url;
		a.target = "_blank";
		span = document.createElement("span");
		span.setAttribute("class", "glyphicon glyphicon-file");
		a.appendChild(span);
		a.appendChild(document.createTextNode(" " + label));

		li.appendChild(a);
		this.resultsList.appendChild(li);
	};

	PrintUI.prototype.getSelectedTempalteName = function () {
		var templateSelect = this.form.querySelector("select[name='template']");
		if (!templateSelect) {
			throw new TypeError("Could not get template select element.");
		}
		return templateSelect.value;
	};

	// Just return a value to define the module export.
	// This example returns an object, but the module
	// can return a function as the exported value.
	return PrintUI;
}));