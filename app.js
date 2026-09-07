(function () {
	"use strict";

	var STORAGE_KEY = "world-explorer-visited";
	var visitedLocations = loadVisitedLocations();
	var chart;
	var locationCount = 0;
	var visitedCount = 0;
	var dataApi;
	var initialized = false;
	var worldMap;
	var searchOpenStates = new Map();
	var searchActive = false;
	var searchQuery = "";
	var searchIndex = [];
	var countryDetailsByCode = new Map();
	var hydratingSearchResults = false;
	var launchInProgress = false;

	function createElement(tagName, text, className) {
		var element = document.createElement(tagName);
		element.textContent = text;
		if (className) element.className = className;
		return element;
	}

	function slugify(value) {
		return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
	}

	function normalizeSearchValue(value) {
		return value.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
	}

	function createLocationControl(label, id, level) {
		var wrapper = createElement("label", null, "location-control location-control--" + level);
		var checkbox = document.createElement("input");
		var labelText = createElement("span", label);

		checkbox.type = "checkbox";
		checkbox.dataset.locationId = id;
		checkbox.addEventListener("click", function (event) {
			event.stopPropagation();
		});
		checkbox.addEventListener("change", handleLocationChange);
		wrapper.append(checkbox, labelText);

		locationCount += 1;
		return { wrapper: wrapper, checkbox: checkbox };
	}

	function createContinentDetails(continent, continentIndex) {
		var continentId = "continent-" + continentIndex + "-" + slugify(continent.name);
		var details = createElement("details");
		var summary = document.createElement("summary");
		var control = createLocationControl(continent.name, continentId, "continent");
		var list = createElement("ul");
		details.className = "continent-node";
		details.dataset.search = continent.name.toLowerCase();

		continent.countries.forEach(function (country, countryIndex) {
			var item = createElement("li");
			item.appendChild(createCountryDetails(country, continentId, countryIndex));
			list.appendChild(item);
		});

		summary.appendChild(control.wrapper);
		details.dataset.locationId = continentId;
		details.append(summary, list);
		return details;
	}

	function createCountryDetails(country, continentId, countryIndex) {
		var countryId = continentId + "/country-" + countryIndex + "-" + slugify(country.name);
		var details = document.createElement("details");
		var summary = document.createElement("summary");
		var control = createLocationControl(country.flag + " " + country.name, countryId, "country");
		var list = createElement("ul");
		details.className = "country-node";
		details.dataset.search = normalizeSearchValue(country.name);

		details.dataset.locationId = countryId;
		details.dataset.countryCode = country.isoCode;
		details.dataset.loaded = "false";
		countryDetailsByCode.set(country.isoCode, details);
		summary.appendChild(control.wrapper);
		details.append(summary, list);
		details.addEventListener("toggle", function () {
			if (details.open && details.dataset.loaded === "false") {
				loadStates(details, list, countryId, country.isoCode);
			}
		});
		return details;
	}

	function loadStates(countryDetails, list, countryId, countryCode) {
		countryDetails.dataset.loaded = "loading";
		var states = dataApi.State.getStatesOfCountry(countryCode);

		states.forEach(function (state, stateIndex) {
			list.appendChild(createStateItem(state, countryId, stateIndex));
		});

		countryDetails.dataset.loaded = "true";
		restoreLoadedState(countryDetails);
		updateDetailsStatus(countryDetails);
		updateProgress();
		if (searchActive && !hydratingSearchResults) applySearchQuery(searchQuery);
	}

	function createStateItem(state, countryId, stateIndex) {
		var stateId = countryId + "/state-" + stateIndex + "-" + slugify(state.name);
		var control = createLocationControl(state.name, stateId, "state");
		control.wrapper.dataset.locationId = stateId;
		var item = createElement("li");
		item.className = "state-node";
		item.dataset.treeNode = "state";
		item.dataset.search = normalizeSearchValue(state.name);
		item.appendChild(control.wrapper);
		return item;
	}

	function handleLocationChange(event) {
		var checkbox = event.target;
		var control = checkbox.closest(".location-control");
		var details = checkbox.closest("details");
		var checked = checkbox.checked;

		checkbox.indeterminate = false;
		control.classList.toggle("is-visited", checked);
		control.classList.remove("is-partial");
		setVisited(checkbox.dataset.locationId, checked);

		if (details) {
			var isParentCheckbox = checkbox === details.querySelector(":scope > summary input");
			if (isParentCheckbox) {
				details.dataset.propagation = checked ? "checked" : "unchecked";
				propagateToDescendants(details, checkbox, checked);
			}
			updateParentStatus(checkbox);
		}
		saveVisitedLocations();
		updateProgress();
	}

	function propagateToDescendants(details, parentCheckbox, checked) {
		details.querySelectorAll("input[data-location-id]").forEach(function (checkbox) {
			if (checkbox === parentCheckbox) return;

			checkbox.checked = checked;
			checkbox.indeterminate = false;
			checkbox.closest(".location-control").classList.toggle("is-visited", checked);
			checkbox.closest(".location-control").classList.remove("is-partial");
			setVisited(checkbox.dataset.locationId, checked);
		});
	}

	function getImmediateChildCheckboxes(details) {
		var list = Array.from(details.children).find(function (child) {
			return child.tagName === "UL";
		});

		if (!list) return [];

		return Array.from(list.children).map(function (item) {
			var nestedDetails = Array.from(item.children).find(function (child) {
				return child.tagName === "DETAILS";
			});
			var summary = nestedDetails && Array.from(nestedDetails.children).find(function (child) {
				return child.tagName === "SUMMARY";
			});
			var directControl = Array.from(item.querySelectorAll(".location-control input[data-location-id]")).find(function (input) {
				return input.closest(".location-control").parentElement === item;
			});

			return summary ? summary.querySelector("input[data-location-id]") : directControl;
		}).filter(Boolean);
	}

	function updateDetailsStatus(details) {
		var parentSummary = Array.from(details.children).find(function (child) {
			return child.tagName === "SUMMARY";
		});
		var parentCheckbox = parentSummary && parentSummary.querySelector("input[data-location-id]");
		var siblings = getImmediateChildCheckboxes(details);

		if (!parentCheckbox || !siblings.length) return;

		var checkedCount = siblings.filter(function (checkbox) { return checkbox.checked; }).length;
		parentCheckbox.checked = checkedCount === siblings.length;
		parentCheckbox.indeterminate = checkedCount > 0 && checkedCount < siblings.length;
		parentCheckbox.closest(".location-control").classList.toggle("is-visited", parentCheckbox.checked);
		parentCheckbox.closest(".location-control").classList.toggle("is-partial", parentCheckbox.indeterminate);
		setVisited(parentCheckbox.dataset.locationId, parentCheckbox.checked);

		updateParentStatus(parentCheckbox);
	}

	function updateParentStatus(childCheckbox) {
		var childDetails = childCheckbox.closest("details");
		var childSummary = childCheckbox.closest("summary");
		var parentDetails = childSummary
			? childDetails.parentElement.closest("details")
			: childDetails;

		if (!parentDetails) return;
		updateDetailsStatus(parentDetails);
	}

	function restoreLoadedState(container) {
		container.querySelectorAll("input[data-location-id]").forEach(function (checkbox) {
			checkbox.checked = Boolean(visitedLocations[checkbox.dataset.locationId]);
			checkbox.closest(".location-control").classList.toggle("is-visited", checkbox.checked);
		});
		applyInheritedParentState(container);
	}

	function applyInheritedParentState(container) {
		var parentDetails = container.closest("details");
		var propagation = parentDetails && parentDetails.dataset.propagation;

		while (parentDetails && !propagation) {
			parentDetails = parentDetails.parentElement.closest("details");
			propagation = parentDetails && parentDetails.dataset.propagation;
		}

		if (propagation !== "checked" && propagation !== "unchecked") return;
		var checked = propagation === "checked";

		container.querySelectorAll("input[data-location-id]").forEach(function (checkbox) {
			checkbox.checked = checked;
			checkbox.indeterminate = false;
			checkbox.closest(".location-control").classList.toggle("is-visited", checked);
			checkbox.closest(".location-control").classList.remove("is-partial");
			setVisited(checkbox.dataset.locationId, checked);
		});
	}

	function setVisited(id, checked) {
		if (checked) {
			visitedLocations[id] = true;
		} else {
			delete visitedLocations[id];
		}
	}

	function loadVisitedLocations() {
		try {
			return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
		} catch (error) {
			return {};
		}
	}

	function saveVisitedLocations() {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(visitedLocations));
	}

	function updateProgress() {
		var checkboxes = Array.from(document.querySelectorAll("input[data-location-id]"));
		visitedCount = checkboxes.filter(function (checkbox) { return checkbox.checked; }).length;
		locationCount = checkboxes.length;
		var percentage = locationCount ? Math.round((visitedCount / locationCount) * 100) : 0;

		document.getElementById("visited-count").textContent = visitedCount;
		document.getElementById("total-count").textContent = locationCount;
		document.querySelector(".chart-value").textContent = percentage + "%";
		updateShareLinks();

		if (chart) {
			chart.data.datasets[0].data = [visitedCount, Math.max(locationCount - visitedCount, 0)];
			chart.update();
		}
		updateWorldMap();
	}

	function getShareDetails() {
		var shareUrl = window.location.href;
		var shareText = "I have explored " + visitedCount + " of " + locationCount + " destinations with World Explorer Tracker.";
		return { url: shareUrl, text: shareText, title: "My World Explorer Travel Card" };
	}

	function updateShareLinks() {
		var details = getShareDetails();
		var encodedUrl = encodeURIComponent(details.url);
		var encodedText = encodeURIComponent(details.text);
		var linkedIn = document.getElementById("shareLinkedIn");
		var twitter = document.getElementById("shareTwitter");
		var whatsApp = document.getElementById("shareWhatsApp");
		var instagram = document.getElementById("shareInstagram");

		if (linkedIn) linkedIn.dataset.shareUrl = "https://www.linkedin.com/sharing/share-offsite/?url=" + encodedUrl;
		if (twitter) twitter.dataset.shareUrl = "https://twitter.com/intent/tweet?text=" + encodedText + "&url=" + encodedUrl;
		if (whatsApp) whatsApp.dataset.shareUrl = "https://wa.me/?text=" + encodeURIComponent(details.text + " " + details.url);
		if (instagram) instagram.dataset.shareUrl = "https://www.instagram.com/";
	}

	function createTravelCardImage(callback) {
		var canvas = document.createElement("canvas");
		var context = canvas.getContext("2d");
		var mapSvg = document.querySelector("#world-map svg");
		var percentage = locationCount ? Math.round((visitedCount / locationCount) * 100) : 0;
		var width = 1200;
		var height = 1200;

		canvas.width = width;
		canvas.height = height;
		context.fillStyle = "#fff4df";
		context.fillRect(0, 0, width, height);
		context.fillStyle = "#f47743";
		context.fillRect(0, 0, width, 330);
		context.fillStyle = "#fffdf8";
		context.font = "700 26px Manrope, sans-serif";
		context.fillText("WORLD EXPLORER TRACKER", 72, 78);
		context.font = "800 72px Manrope, sans-serif";
		context.fillText("Your Travel Card", 72, 178);
		context.font = "500 25px Manrope, sans-serif";
		context.fillText("A record of the places that shaped your journey.", 72, 235);

		context.fillStyle = "#17324d";
		context.font = "800 64px Manrope, sans-serif";
		context.fillText(percentage + "%", 72, 430);
		context.font = "500 23px Manrope, sans-serif";
		context.fillText("EXPLORED", 78, 468);
		context.font = "800 42px Manrope, sans-serif";
		context.fillText(String(visitedCount), 450, 430);
		context.font = "500 23px Manrope, sans-serif";
		context.fillText("VISITED", 454, 468);
		context.font = "800 42px Manrope, sans-serif";
		context.fillText(String(locationCount), 760, 430);
		context.font = "500 23px Manrope, sans-serif";
		context.fillText("MAPPED", 764, 468);

		context.fillStyle = "#17324d";
		context.fillRect(58, 535, 1084, 585);
		if (!mapSvg) {
			callback(canvas);
			return;
		}

		var svgBlob = new Blob([new XMLSerializer().serializeToString(mapSvg)], { type: "image/svg+xml;charset=utf-8" });
		var mapImage = new Image();
		var mapUrl = URL.createObjectURL(svgBlob);
		mapImage.onload = function () {
			var scale = Math.min(1020 / mapImage.width, 520 / mapImage.height);
			var mapWidth = mapImage.width * scale;
			var mapHeight = mapImage.height * scale;
			context.drawImage(mapImage, 90 + (1020 - mapWidth) / 2, 570 + (520 - mapHeight) / 2, mapWidth, mapHeight);
			URL.revokeObjectURL(mapUrl);
			callback(canvas);
		};
		mapImage.onerror = function () {
			URL.revokeObjectURL(mapUrl);
			callback(canvas);
		};
		mapImage.src = mapUrl;
	}

	function shareTravelCardImage(platform, fallbackUrl) {
		var status = document.getElementById("shareStatus");
		var shareButtons = Array.from(document.querySelectorAll(".share-button"));
		var shareWindow = fallbackUrl ? window.open(fallbackUrl, "_blank") : null;
		shareButtons.forEach(function (button) { button.disabled = true; });
		var finish = function () {
			shareButtons.forEach(function (button) { button.disabled = false; });
		};

		createTravelCardImage(function (canvas) {
			canvas.toBlob(function (blob) {
				if (!blob) {
					status.textContent = "Unable to create the travel card image.";
					finish();
					return;
				}

				var downloadUrl = URL.createObjectURL(blob);
				var downloadLink = document.createElement("a");
				downloadLink.href = downloadUrl;
				downloadLink.download = "world-explorer-travel-card.png";
				downloadLink.style.display = "none";
				document.body.appendChild(downloadLink);
				downloadLink.click();
				downloadLink.remove();
				setTimeout(function () { URL.revokeObjectURL(downloadUrl); }, 1000);
				if (fallbackUrl && !shareWindow) {
					status.textContent = "Your browser blocked the share window. Image downloaded; open " + platform + " to finish sharing.";
					finish();
					return;
				}
				status.textContent = "Image downloaded. Attach it in " + platform + " to finish sharing.";
				finish();
			}, "image/png");
		});
	}

	function initializeChart() {
		if (chart) return;
		var canvas = document.getElementById("progress-chart");
		if (!canvas || typeof Chart === "undefined") return;

		chart = new Chart(canvas, {
			type: "doughnut",
			data: {
				labels: ["Visited", "Remaining"],
				datasets: [{ data: [0, 1], backgroundColor: ["#f05d4e", "#b8dcd8"], borderWidth: 0, borderRadius: 8, spacing: 3 }]
			},
			options: {
				cutout: "78%",
				plugins: { legend: { display: false }, tooltip: { enabled: false } },
				animation: { duration: 700, easing: "easeOutQuart" }
			}
		});
	}

	function initializeWorldMap() {
		if (worldMap || typeof jsVectorMap === "undefined") return;

		worldMap = new jsVectorMap({
			selector: "#world-map",
			map: "world",
			zoomButtons: true,
			zoomOnScroll: false,
			regionStyle: {
				initial: { fill: "#5bb8aa", stroke: "#ffd166", strokeWidth: 1 },
				selected: { fill: "#f05d4e" },
				hoover: { fill: "#ffd166" }
			},
			selectedRegions: []
		});
		updateWorldMap();
	}

	function updateWorldMap() {
		if (!worldMap) return;

		var visitedCountries = new Set();
		document.querySelectorAll(".country-node").forEach(function (countryDetails) {
			if (countryDetails.querySelector("input[data-location-id]:checked")) {
				visitedCountries.add(countryDetails.dataset.countryCode.toLowerCase());
			}
		});

		worldMap.setSelectedRegions(Array.from(visitedCountries));
		document.querySelectorAll("#world-map path[data-code]").forEach(function (region) {
			var isVisited = visitedCountries.has(region.dataset.code.toLowerCase());
			region.setAttribute("fill", isVisited ? "#f47743" : "#5bb8aa");
		});
	}

	function renderDirectory(container, data) {
		container.innerHTML = "";
		locationCount = 0;
		searchIndex = [];
		countryDetailsByCode.clear();

		if (!data || !Array.isArray(data.continents)) return;

		data.continents.forEach(function (continent, index) {
			searchIndex.push({ name: normalizeSearchValue(continent.name), type: "continent" });
			container.appendChild(createContinentDetails(continent, index));
			continent.countries.forEach(function (country) {
				searchIndex.push({ name: normalizeSearchValue(country.name), type: "country", countryCode: country.isoCode });
				dataApi.State.getStatesOfCountry(country.isoCode).forEach(function (state) {
					searchIndex.push({ name: normalizeSearchValue(state.name), type: "state", countryCode: country.isoCode });
				});
			});
		});
	}

	function debounce(callback, delay) {
		var timer;

		return function () {
			var context = this;
			var argumentsList = arguments;
			clearTimeout(timer);
			timer = setTimeout(function () {
				callback.apply(context, argumentsList);
			}, delay);
		};
	}

	function markDetailsSubtree(details, decisions) {
		decisions.set(details, { isVisible: true, shouldExpand: false });
		details.querySelectorAll(":scope > ul > li").forEach(function (item) {
			var childDetails = item.querySelector(":scope > details");
			decisions.set(item, { isVisible: true, shouldExpand: false });
			if (childDetails) markDetailsSubtree(childDetails, decisions);
		});
	}

	function evaluateDetails(details, query, decisions) {
		var ownMatch = details.dataset.search.indexOf(query) !== -1;
		var descendantMatch = false;
		var list = details.querySelector(":scope > ul");

		decisions.set(details, { isVisible: ownMatch, shouldExpand: ownMatch });

		if (list) {
			Array.from(list.children).forEach(function (item) {
				var childDetails = item.querySelector(":scope > details");
				var childMatch;

				if (childDetails) {
					childMatch = evaluateDetails(childDetails, query, decisions);
				} else {
					childMatch = item.dataset.treeNode === "state" && item.dataset.search.indexOf(query) !== -1;
					decisions.set(item, { isVisible: childMatch, shouldExpand: false });
				}

				decisions.set(item, { isVisible: childMatch, shouldExpand: false });
				descendantMatch = descendantMatch || childMatch;
			});
		}

		if (ownMatch) {
			markDetailsSubtree(details, decisions);
			decisions.get(details).shouldExpand = true;
		} else if (descendantMatch) {
			decisions.get(details).isVisible = true;
			decisions.get(details).shouldExpand = true;
		}

		return ownMatch || descendantMatch;
	}

	function applySearchDecisions(decisions) {
		document.querySelectorAll("#directory details, #directory li").forEach(function (element) {
			var decision = decisions.get(element) || { isVisible: false, shouldExpand: false };
			element.classList.toggle("hidden", !decision.isVisible);

			if (element.tagName === "DETAILS") {
				element.open = decision.shouldExpand;
			}
		});
	}

	function saveSearchOpenStates() {
		searchOpenStates.clear();
		document.querySelectorAll("#directory details").forEach(function (details) {
			searchOpenStates.set(details, details.open);
		});
	}

	function clearSearchFilter() {
		document.querySelectorAll("#directory details, #directory li").forEach(function (element) {
			element.classList.remove("hidden");
		});
		document.querySelectorAll("#directory details").forEach(function (details) {
			details.open = searchOpenStates.has(details) ? searchOpenStates.get(details) : false;
			var summary = details.querySelector(":scope > summary");
			if (summary) summary.removeAttribute("aria-hidden");
	});
		searchOpenStates.clear();
		searchActive = false;
		searchQuery = "";
	}

	function updateClearSearchButton(searchInput) {
		var clearButton = document.getElementById("clearSearch");
		if (clearButton) clearButton.hidden = searchInput.value.length === 0;
	}

	function applySearchQuery(query) {
		if (!query) {
			clearSearchFilter();
			return;
		}

		if (!searchActive) {
			saveSearchOpenStates();
			searchActive = true;
		}

		hydratingSearchResults = true;
		searchIndex.forEach(function (result) {
			if (result.name.indexOf(query) === -1 || !result.countryCode) return;
			var countryDetails = countryDetailsByCode.get(result.countryCode);
			if (countryDetails && countryDetails.dataset.loaded === "false") {
				loadStates(countryDetails, countryDetails.querySelector(":scope > ul"), countryDetails.dataset.locationId, result.countryCode);
			}
		});
		hydratingSearchResults = false;

		var decisions = new Map();
		document.querySelectorAll("#directory > details").forEach(function (details) {
			evaluateDetails(details, query, decisions);
		});
		applySearchDecisions(decisions);
	}

	function filterDirectory(event) {
		searchQuery = normalizeSearchValue(event.target.value);
		updateClearSearchButton(event.target);
		applySearchQuery(searchQuery);
	}

	function expandAll() {
		document.querySelectorAll("#directory details").forEach(function (details) {
			details.open = true;
		});
	}

	function collapseAll() {
		document.querySelectorAll("#directory details").forEach(function (details) {
			details.open = false;
		});
	}

	function clearSelection() {
		document.querySelectorAll("input[type='checkbox']").forEach(function (checkbox) {
			checkbox.checked = false;
			checkbox.indeterminate = false;
			checkbox.closest(".location-control").classList.remove("is-visited", "is-partial");
		});
		document.querySelectorAll("#directory details").forEach(function (details) {
			delete details.dataset.propagation;
		});
		visitedLocations = {};
		localStorage.removeItem(STORAGE_KEY);
		updateProgress();
	}

	function initializeSearch() {
		var searchInput = document.getElementById("destinationSearch");
		var clearButton = document.getElementById("clearSearch");

		if (searchInput) searchInput.addEventListener("input", debounce(filterDirectory, 300));
		if (clearButton) clearButton.addEventListener("click", function () {
			if (searchInput.value && !searchActive) saveSearchOpenStates();
			searchInput.value = "";
			clearSearchFilter();
			updateClearSearchButton(searchInput);
			searchInput.focus();
		});
	}

	function initializeTreeControls() {
		var expandButton = document.getElementById("expandAll");
		var collapseButton = document.getElementById("collapseAll");
		var clearSelectionButton = document.getElementById("clearSelection");

		if (expandButton) expandButton.addEventListener("click", expandAll);
		if (collapseButton) collapseButton.addEventListener("click", collapseAll);
		if (clearSelectionButton) clearSelectionButton.addEventListener("click", clearSelection);
	}

	function openStats() {
		var modal = document.getElementById("stats-modal");
		modal.hidden = false;
		document.body.classList.add("modal-open");
		initializeChart();
		initializeWorldMap();
		updateProgress();
	}

	function closeStats() {
		document.getElementById("stats-modal").hidden = true;
		document.body.classList.remove("modal-open");
	}

	function initializeStatsModal() {
		var viewStatsButton = document.getElementById("viewStats");
		var beginButton = document.getElementById("beginExpedition");

		if (viewStatsButton) viewStatsButton.addEventListener("click", openStats);
		document.querySelectorAll(".share-button").forEach(function (shareButton) {
			shareButton.addEventListener("click", function () {
				shareTravelCardImage(this.dataset.sharePlatform, this.dataset.shareUrl);
			});
		});
		document.querySelectorAll("[data-close-stats]").forEach(function (element) {
			element.addEventListener("click", closeStats);
		});
		document.addEventListener("keydown", function (event) {
			if (event.key === "Escape") closeStats();
		});
		if (beginButton) beginButton.addEventListener("click", function () {
			if (launchInProgress) return;
			launchInProgress = true;
			beginButton.disabled = true;
			document.getElementById("start-page").classList.add("is-leaving");
			setTimeout(function () {
				document.getElementById("start-page").classList.add("hidden");
				document.getElementById("app-shell").classList.remove("hidden");
			}, 420);
		});
	}

	document.addEventListener("DOMContentLoaded", function () {
		if (initialized) return;
		initialized = true;
		initializeSearch();
		initializeTreeControls();
		initializeStatsModal();

		window.worldDataReady.then(function (data) {
			dataApi = data.api;
			var beginButton = document.getElementById("beginExpedition");
			var loadingStatus = document.getElementById("loading-status");

			if (!dataApi) {
				loadingStatus.textContent = "Map data unavailable. Refresh to retry.";
				beginButton.textContent = "Data Unavailable";
				return;
			}

			var directory = document.getElementById("directory");
			renderDirectory(directory, data);
			updateProgress();
			beginButton.disabled = false;
			beginButton.textContent = "Begin Expedition";
			loadingStatus.textContent = "Map calibrated. Ready to explore.";
		});
	});
})();
