# Anime Filtering Engine: Explanation

This document provides a comprehensive explanation of the anime filtering engine, from data acquisition to the final filtering logic.

## 1. Data Acquisition and Preparation

The data acquisition process involves the following steps:

*   **Raw Data:** The process begins with the `mal_anime_data.csv` file, located in the `data` directory. This CSV file contains a comprehensive list of anime titles and their associated metadata, such as score, popularity, rank, genres, and more.

*   **Conversion to JSON:** The `data/index.js` script, which utilizes the `csv-parser` library, reads the `mal_anime_data.csv` file and converts its contents into a JSON format.

*   **Data for the Frontend:** The resulting JSON data is saved as `anime-data.json` and moved to the `website/public` directory, making it accessible to the frontend application. The `website/src/lib/data.ts` file then reads this JSON file and exports it as a string.

## 2. Frontend and Backend Interaction

The frontend and backend interact as follows:

*   **Chat Interface:** The user interacts with a chatbot interface, which is built using React and the `@ai-sdk/react` library in the `website/src/app/page.tsx` file.

*   **API Route:** The frontend communicates with the backend through an API route located at `website/src/app/api/chat/route.ts`.

*   **AI Model:** This API route uses the `@ai-sdk/google` library to interact with the Gemini AI model (`gemini-1.5-flash`). It sends the user's messages to the AI and streams the response back to the frontend.

## 3. Filtering Logic

The core of the filtering logic resides in the `website/src/lib/anime.ts` file.

*   **Core Filtering Engine:** This file defines the data structures for anime and filters, and it contains the `AnimeFilterContext` class, which allows for chaining multiple filters.

*   **`filterAnime` Function:** The main function for filtering is `filterAnime`, which takes the anime data and a set of filters as input and returns the filtered results.

*   **Filter Types:** The filtering engine supports various types of filters, including:
    *   **Text-based fuzzy search:** For searching by title, English name, Japanese name, description, or synonyms.
    *   **Numeric filters:** For filtering by score, popularity, rank, members, and episodes, with support for operators like `eq`, `gt`, `gte`, `lt`, `lte`, and `between`.
    *   **Categorical filters:** For filtering by type, status, genres, demographic, studios, producers, source, and rating, with support for multi-select and `AND`/`OR` logic.
    *   **Date filters:** For filtering by aired date and premiered season.

*   **Helper Functions:** The `anime.ts` file also includes several helper functions to simplify the filtering process, such as:
    *   `searchAnimeByText`: For performing a simple text search.
    *   `filterAnimeByGenre`: For filtering by one or more genres.
    *   `filterAnimeByScore`: For filtering by a score range.
    *   `getUniqueValues`: For getting all unique values for a specific field, which can be used to populate dropdown menus in the UI.
    *   `getFieldStatistics`: For getting statistics (min, max, average) for numeric fields.

## How to Use the Filtering Engine

To use the filtering engine, follow these steps:

1.  **Load the Data:** First, you need to load the anime data using the `loadAnimeData` function from `website/src/lib/anime.ts`. This function fetches the `anime-data.json` file and parses it into an array of `Anime` objects.

2.  **Create a Filter Chain (Optional):** If you want to apply multiple filters in a chained manner, you can create a new `AnimeFilterContext` instance with the initial data.

3.  **Define Filters:** Create a filter object that specifies the filtering criteria. For example, to find all action anime with a score greater than 8.0, you would create an object like this:

    ```typescript
    const filters: AnimeFilters = {
      genres: ['Action'],
      score: { operator: 'gte', value: 8.0 },
    };
    ```

4.  **Apply Filters:** Use the `filterAnime` function to apply the filters to the data.

    ```typescript
    const filteredAnime = filterAnime(allAnimeData, filters);
    ```

5.  **Use Helper Functions:** You can also use the provided helper functions for more specific filtering tasks. For example, to search for anime with "Frieren" in the title, you could use:

    ```typescript
    const searchResults = searchAnimeByText(allAnimeData, 'Frieren');
    ```
