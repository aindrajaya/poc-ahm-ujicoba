/*global self*/

// A WebWorker that performs a search for web layers in an ArcGIS Online group.

var layerTypes = '(type:"Feature Collection" OR type:"Feature Service" OR type:"Image Service" OR type:"Map Service" OR type: "WMS") -type:"Web Map" -type:"Web Mapping Application" -type:"Shapefile" -type:"Layer" -type: "Map Document" -type:"Map Package" -type:"ArcPad Package" -type:"Project Package" -type:"Pro Map" -type:"Layout" -type:"Explorer Map" -type:"Globe Document" -type:"Scene Document" -type:"Published Map" -type:"Map Template" -type:"Windows Mobile Package" -type:"Layer Package" -type:"Explorer Layer" -type:"Geoprocessing Package" -type:"Application Template" -type:"Code Sample" -type:"Geoprocessing Package" -type:"Geoprocessing Sample" -type:"Locator Package" -type:"Workflow Manager Package" -type:"Windows Mobile Package" -type:"Explorer Add In" -type:"Desktop Add In" -type:"File Geodatabase" -type:"Feature Collection Template" -type:"Code Attachment" -type:"Featured Items" -type:"Symbol Set" -type:"Color Set" -type:"Windows Viewer Add In" -type:"Windows Viewer Configuration"';
var group = 'group:2485b37bd67d45bf8a1e56c6216eeb7a';
////"group%3A2485b37bd67d45bf8a1e56c6216eeb7a%20(type%3A%22Feature%20Collection%22%20OR%20type%3A%22Feature%20Service%22%20OR%20type%3A%22Image%20Service%22%20OR%20type%3A%22Map%20Service%22%20OR%20type%3A%20%22WMS%22)%20-type%3A%22Web%20Map%22%20-type%3A%22Web%20Mapping%20Application%22%20-type%3A%22Shapefile%22%20-type%3A%22Layer%22%20-type%3A%20%22Map%20Document%22%20-type%3A%22Map%20Package%22%20-type%3A%22ArcPad%20Package%22%20-type%3A%22Project%20Package%22%20-type%3A%22Pro%20Map%22%20-type%3A%22Layout%22%20-type%3A%22Explorer%20Map%22%20-type%3A%22Globe%20Document%22%20-type%3A%22Scene%20Document%22%20-type%3A%22Published%20Map%22%20-type%3A%22Map%20Template%22%20-type%3A%22Windows%20Mobile%20Package%22%20-type%3A%22Layer%20Package%22%20-type%3A%22Explorer%20Layer%22%20-type%3A%22Geoprocessing%20Package%22%20-type%3A%22Application%20Template%22%20-type%3A%22Code%20Sample%22%20-type%3A%22Geoprocessing%20Package%22%20-type%3A%22Geoprocessing%20Sample%22%20-type%3A%22Locator%20Package%22%20-type%3A%22Workflow%20Manager%20Package%22%20-type%3A%22Windows%20Mobile%20Package%22%20-type%3A%22Explorer%20Add%20In%22%20-type%3A%22Desktop%20Add%20In%22%20-type%3A%22File%20Geodatabase%22%20-type%3A%22Feature%20Collection%20Template%22%20-type%3A%22Code%20Attachment%22%20-type%3A%22Featured%20Items%22%20-type%3A%22Symbol%20Set%22%20-type%3A%22Color%20Set%22%20-type%3A%22Windows%20Viewer%20Add%20In%22%20-type%3A%22Windows%20Viewer%20Configuration%22";
////var searchUrl = "http://wsdot.maps.arcgis.com/sharing/rest/search?q={q}&num=100&f=json";
var rootUrl = "http://wsdot.maps.arcgis.com/sharing/rest";
var searchUrl = [rootUrl,  "search"].join("/");

/**
 * Converts an object into a query string.
 * @param {Object} o
 * @returns {string}
 */
function objToQueryString(o) {
	var output = [], v;
	for (var propName in o) {
		if (o.hasOwnProperty(propName)) {
			/*jshint eqnull:true*/
			v = o[propName] != null ? o[propName] : "";
			/*jshint eqnull:false*/
			output.push([encodeURIComponent(propName), "=", v].join(""));
		}
	}
	return output.join("&");
}

/**
 * Returns the full thumbnail URL.
 * @param {Object} item
 * @param {string} [propertyName="thumbnail"] - Valid values: "thumbnail", "largeThumbnail", "banner", "screenshots"
 * @returns {string}
 */
function getFullThumbnailUrl(item, propertyName) {
	// e.g., http://wsdot.maps.arcgis.com/sharing/rest/content/items/4fe77ff9b40342cc997945b71035b1ae/info/thumbnail/FreightAndGoods_svc.png
	// {{rootUrl}}/content/items/4fe77ff9b40342cc997945b71035b1ae/info/thumbnail/FreightAndGoods_svc.png
	// {{rootUrl}}/content/items/{{item id}}/info/{{thumbnail url}}
	if (!propertyName) {
		propertyName = "thumbnail";
	}
	return item[propertyName] ? [rootUrl, "content/items", item.id, "info", item[propertyName]].join("/") : item[propertyName];
}

function sendSearchResultMessage(e) {
	var response;
	response = e.target.response;
	// Some browsers (e.g., IE) return a string instead of an object (ignoring the requested return type).
	// In this case, parse the JSON string.
	if (typeof response === "string") {
		response = JSON.parse(response);
	}
	response.results.forEach(function (result) {
		result.thumbnail = getFullThumbnailUrl(result, "thumbnail");
	});
	self.postMessage({response:response});
}

/**
 * Sends the HTTP request for an AGOL search.
 */
function startSearch(num, sortField, sortOrder, start) {
	var url, request, data;
	url;
	request = new XMLHttpRequest();
	data = {
		q: [group, layerTypes].join(" "),
		sortField: sortField || "title",
		sortOrder: sortOrder || "asc",
		f: "json"
	};
	/*jshint eqnull:true*/
	if (num != null) {
	/*jshint eqnull:false*/

		data.num = num;
	}
	/*jshint eqnull:true*/
	if (start != null) {
	/*jshint eqnull:false*/
		data.start = start;
	}
	url = [searchUrl, objToQueryString(data)].join("?");
	request.open("get", url);
	request.responseType = "json";
	request.onloadend = sendSearchResultMessage;
	request.send();
	
}

self.addEventListener("message", function (e) {
	var data, operation, searchType;
	data = e.data;
	operation = data.operation;
	searchType = data.searchType;
	if (data.operation === "search") {
		startSearch(100);
	}
});