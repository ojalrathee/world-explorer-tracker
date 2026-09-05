window.worldDataReady = Promise.all([
	import("https://esm.sh/country-state-city@3.2.1"),
	fetch("https://raw.githubusercontent.com/dr5hn/countries-states-cities-database/master/json/countries.json")
		.then(function (response) {
			if (!response.ok) {
				throw new Error("Unable to load country metadata.");
			}
			return response.json();
		})
]).then(function (sources) {
	var countryStateCity = sources[0];
	var countryRecords = sources[1];
	var metadataByCode = {};
	var countriesByContinent = {};
	var continentOrder = [];

	function getContinent(record) {
		if (record.region === "Americas") {
			return record.subregion === "South America" ? "South America" : "North America";
		}

		return record.region === "Polar" ? "Antarctica" : (record.region || "Other");
	}

	countryRecords.forEach(function (record) {
		if (record.iso2) {
			metadataByCode[record.iso2] = record;
		}
	});

	countryStateCity.Country.getAllCountries().forEach(function (country) {
		var metadata = metadataByCode[country.isoCode] || {};
		var continent = getContinent(metadata);

		if (!countriesByContinent[continent]) {
			countriesByContinent[continent] = [];
			continentOrder.push(continent);
		}

		countriesByContinent[continent].push({
			name: country.name,
			flag: country.flag,
			isoCode: country.isoCode
		});
	});

	return {
		api: countryStateCity,
		continents: continentOrder.map(function (continent) {
			return {
				name: continent,
				countries: countriesByContinent[continent]
			};
		})
	};
}).catch(function (error) {
	console.error("World data failed to load:", error);
	return { api: null, continents: [] };
});
