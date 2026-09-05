# World Explorer Tracker 

World Explorer Tracker is a personal travel-journal dashboard for recording the places that have shaped your journey. It turns a large geographic directory into a simple, visual progress experience: select continents, countries, and states, then review your exploration as a travel card.

## Project Idea     [(Live Demo)](https://atlastrail.vercel.app/)

Travel memories are often spread across notes, photo albums, and scattered lists. This project provides one lightweight place to build a living record of those experiences.

The core idea is to make travel history feel tangible without requiring an account or backend. A visitor can open the tracker, mark destinations they have visited, and immediately see their progress represented as a percentage, a count, and a highlighted world map.

## Features

- Browse destinations through a continent, country, and state hierarchy.
- Search continents, countries, and states from one search field.
- Expand or collapse the complete directory.
- Mark a parent destination to select or clear its descendants.
- Preserve selections in the browser using `localStorage`.
- View an exploration percentage and visited/mapped destination counts.
- Display visited countries on an interactive world map.
- Generate a shareable travel-card image.
- Share through supported device share functionality, or download the image for manual sharing.
- Use the interface responsively on desktop and mobile screens.

## How It Works

The application is a static client-side web app with no server or database of its own.

1. `world-data.js` loads country and state data from remote sources.
2. `app.js` renders the destination tree and manages selection, search, progress, map, and sharing behavior.
3. `localStorage` stores the selected destination IDs under the `world-explorer-visited` key.
4. `Chart.js` renders the exploration progress chart.
5. `jsVectorMap` renders and updates the visited-country map.
6. `styles.css` provides the visual system and responsive layout.

## Getting Started

### Prerequisites

- A modern web browser with JavaScript enabled.
- Internet access, because the application loads libraries and geographic data from CDNs and remote APIs.
- A local static web server. Running through a server is recommended because the app uses JavaScript modules and remote requests.

### Run Locally

From the project directory, start any static web server. For example, with Python:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

Alternatively, if Node.js is installed:

```bash
npx serve .
```

Open the URL printed by the command.

## Project Structure

```text
.
├── index.html       # Application shell and accessible UI structure
├── app.js           # Application state, interactions, rendering, and sharing
├── styles.css       # Theme, layout, responsive styles, and animations
├── world-data.js    # Remote geographic data loading and normalization
└── README.md        # Project documentation
```

## External Dependencies and Data

The app currently loads these resources at runtime:

- [Chart.js](https://www.chartjs.org/) for the progress doughnut chart.
- [jsVectorMap](https://jvm-docs.vercel.app/) and its world map for geographic visualization.
- [country-state-city](https://www.npmjs.com/package/country-state-city) through `esm.sh` for country and state records.
- [Countries, States and Cities Database](https://github.com/dr5hn/countries-states-cities-database) for country metadata and regional grouping.
- [Google Fonts](https://fonts.google.com/) for the Manrope and DM Mono typefaces.

Because these resources are remote, data availability and application startup depend on network access and the availability of those services.

## Data and Privacy

Destination selections are stored locally in the browser. The project does not include a backend, user account system, or application database. Clearing browser storage for the site will remove the saved travel selections.

Sharing a travel card may use the browser's native share API where supported. On unsupported browsers, the generated PNG is downloaded and the relevant social platform is opened as a fallback.

## Current Scope

This project is intentionally focused on a fast, personal tracking experience. It does not currently provide:

- Cloud synchronization between devices.
- User accounts or authentication.
- Trip dates, notes, photos, or itinerary management.
- Offline geographic data caching.
- Automated test or build tooling.

These are natural directions for a future version if the tracker evolves into a multi-device travel journal.

## License

No license has been specified for this project yet. Add a license before distributing or reusing the code publicly.
