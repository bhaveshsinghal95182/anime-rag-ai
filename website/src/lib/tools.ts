import { tool } from "ai";
import { z } from "zod";
import { 
  loadAnimeData, 
  searchAnimeByText, 
  filterAnime, 
  getUniqueValues, 
  getFieldStatistics,
  type Anime,
  type AnimeFilters
} from "./anime";

export const tools = {
  searchAnime: tool({
    description: "Search for anime by title, description, or other text content using fuzzy matching",
    inputSchema: z.object({
      query: z.string().describe("The search query to find anime (searches titles, descriptions, synonyms)"),
      limit: z.number().optional().describe("Maximum number of results to return (default: all results)"),
    }),
    execute: async ({ query, limit }) => {
      try {
        const animeData = await loadAnimeData();
        const results = searchAnimeByText(animeData, query);
        
        if (!results || results.length === 0) {
          return {
            success: false,
            message: `No anime found matching "${query}"`,
            results: []
          };
        }

        const limitedResults = limit ? results.slice(0, limit) : results;
        return {
          success: true,
          message: `Found ${results.length} anime matching "${query}"`,
          results: limitedResults.map(anime => ({
            title: anime.Title,
            englishTitle: anime.English,
            score: anime.Score,
            episodes: anime.Episodes,
            type: anime.Type,
            status: anime.Status,
            genres: anime.Genres,
            description: anime.Description?.substring(0, 200) + (anime.Description?.length > 200 ? '...' : ''),
            year: anime.Aired?.match(/\d{4}/)?.[0] || 'Unknown'
          })),
          totalCount: results.length
        };
      } catch (error) {
        return {
          success: false,
          message: "Failed to search anime data",
          error: error instanceof Error ? error.message : String(error),
          results: []
        };
      }
    },
  }),

  filterAnime: tool({
    description: "Filter anime by various criteria including genre, score, episodes, type, and more",
    inputSchema: z.object({
      // Text search
      searchQuery: z.string().optional().describe("Text to search for in titles and descriptions"),
      
      // Numeric filters
      minScore: z.number().optional().describe("Minimum score (0-10)"),
      maxScore: z.number().optional().describe("Maximum score (0-10)"),
      minEpisodes: z.number().optional().describe("Minimum number of episodes"),
      maxEpisodes: z.number().optional().describe("Maximum number of episodes"),
      minRank: z.number().optional().describe("Minimum rank"),
      maxRank: z.number().optional().describe("Maximum rank"),
      
      // Categorical filters
      genres: z.array(z.string()).optional().describe("Genres to filter by (e.g., ['Action', 'Drama'])"),
      types: z.array(z.string()).optional().describe("Anime types (e.g., ['TV', 'Movie', 'OVA'])"),
      statuses: z.array(z.string()).optional().describe("Status (e.g., ['Finished Airing', 'Currently Airing'])"),
      studios: z.array(z.string()).optional().describe("Animation studios"),
      demographics: z.array(z.string()).optional().describe("Target demographics (e.g., ['Shounen', 'Seinen'])"),
      sources: z.array(z.string()).optional().describe("Source material (e.g., ['Manga', 'Light novel'])"),
      ratings: z.array(z.string()).optional().describe("Content ratings (e.g., ['PG-13', 'R'])"),
      
      // Date filters
      startYear: z.string().optional().describe("Earliest year to include (YYYY format)"),
      endYear: z.string().optional().describe("Latest year to include (YYYY format)"),
      
      // Sorting and pagination
      sortBy: z.enum(['Score', 'Popularity', 'Rank', 'Episodes', 'Title']).optional().describe("Field to sort by"),
      sortDirection: z.enum(['asc', 'desc']).optional().describe("Sort direction"),
      limit: z.number().optional().describe("Maximum number of results to return (default: all results)"),
      offset: z.number().optional().describe("Number of results to skip"),
    }),
    execute: async (params) => {
      try {
        const animeData = await loadAnimeData();
        
        // Build the filter object
        const filters: AnimeFilters = {};
        
        if (params.searchQuery) {
          filters.search = { query: params.searchQuery };
        }
        
        if (params.minScore !== undefined || params.maxScore !== undefined) {
          filters.score = {
            min: params.minScore,
            max: params.maxScore
          };
        }
        
        if (params.minEpisodes !== undefined || params.maxEpisodes !== undefined) {
          filters.episodes = {
            min: params.minEpisodes,
            max: params.maxEpisodes
          };
        }
        
        if (params.minRank !== undefined || params.maxRank !== undefined) {
          filters.rank = {
            min: params.minRank,
            max: params.maxRank
          };
        }
        
        if (params.genres && params.genres.length > 0) {
          filters.genres = params.genres;
        }
        
        if (params.types && params.types.length > 0) {
          filters.type = params.types;
        }
        
        if (params.statuses && params.statuses.length > 0) {
          filters.status = params.statuses;
        }
        
        if (params.studios && params.studios.length > 0) {
          filters.studios = params.studios;
        }
        
        if (params.demographics && params.demographics.length > 0) {
          filters.demographic = params.demographics;
        }
        
        if (params.sources && params.sources.length > 0) {
          filters.source = params.sources;
        }
        
        if (params.ratings && params.ratings.length > 0) {
          filters.rating = params.ratings;
        }
        
        if (params.startYear || params.endYear) {
          filters.aired = {
            start: params.startYear,
            end: params.endYear
          };
        }
        
        if (params.sortBy) {
          filters.sort = [{
            field: params.sortBy,
            direction: params.sortDirection || 'desc'
          }];
        }
        
        if (params.limit !== undefined) {
          filters.limit = params.limit;
        }
        // No default limit - return all results unless explicitly limited
        
        if (params.offset !== undefined) {
          filters.offset = params.offset;
        }
        
        const results = filterAnime(animeData, filters);
        
        if (!results || results.length === 0) {
          return {
            success: false,
            message: "No anime found matching the specified criteria",
            results: [],
            totalCount: 0
          };
        }
        
        return {
          success: true,
          message: `Found ${results.length} anime matching the criteria`,
          results: results.map(anime => ({
            title: anime.Title,
            englishTitle: anime.English,
            score: anime.Score,
            rank: anime.Rank,
            popularity: anime.Popularity,
            episodes: anime.Episodes,
            type: anime.Type,
            status: anime.Status,
            genres: anime.Genres,
            studios: anime.Studios,
            demographic: anime.Demographic,
            rating: anime.Rating,
            source: anime.Source,
            description: anime.Description?.substring(0, 200) + (anime.Description?.length > 200 ? '...' : ''),
            year: anime.Aired?.match(/\d{4}/)?.[0] || 'Unknown',
            aired: anime.Aired
          })),
          totalCount: results.length,
          appliedFilters: Object.keys(filters).filter(key => key !== 'limit' && key !== 'offset')
        };
      } catch (error) {
        return {
          success: false,
          message: "Failed to filter anime data",
          error: error instanceof Error ? error.message : String(error),
          results: []
        };
      }
    },
  }),

  filterAnimeWithExclusions: tool({
    description: "Advanced filter that allows including specific criteria while explicitly excluding others (e.g., include comedy but exclude action)",
    inputSchema: z.object({
      // Include filters (what you want)
      includeGenres: z.array(z.string()).optional().describe("Genres to include (e.g., ['Comedy', 'Slice of Life'])"),
      includeTypes: z.array(z.string()).optional().describe("Types to include (e.g., ['TV', 'Movie'])"),
      includeStatuses: z.array(z.string()).optional().describe("Statuses to include"),
      includeStudios: z.array(z.string()).optional().describe("Studios to include"),
      includeDemographics: z.array(z.string()).optional().describe("Demographics to include"),
      includeSources: z.array(z.string()).optional().describe("Sources to include"),
      includeRatings: z.array(z.string()).optional().describe("Ratings to include"),
      
      // Exclude filters (what you don't want)
      excludeGenres: z.array(z.string()).optional().describe("Genres to exclude (e.g., ['Mystery', 'Action'])"),
      excludeTypes: z.array(z.string()).optional().describe("Types to exclude"),
      excludeStatuses: z.array(z.string()).optional().describe("Statuses to exclude"),
      excludeStudios: z.array(z.string()).optional().describe("Studios to exclude"),
      excludeDemographics: z.array(z.string()).optional().describe("Demographics to exclude"),
      excludeSources: z.array(z.string()).optional().describe("Sources to exclude"),
      excludeRatings: z.array(z.string()).optional().describe("Ratings to exclude"),
      
      // Text search
      searchQuery: z.string().optional().describe("Text to search for in titles and descriptions"),
      
      // Numeric filters
      minScore: z.number().optional().describe("Minimum score (0-10)"),
      maxScore: z.number().optional().describe("Maximum score (0-10)"),
      minEpisodes: z.number().optional().describe("Minimum number of episodes"),
      maxEpisodes: z.number().optional().describe("Maximum number of episodes"),
      
      // Date filters
      startYear: z.string().optional().describe("Earliest year to include (YYYY format)"),
      endYear: z.string().optional().describe("Latest year to include (YYYY format)"),
      
      // Sorting and pagination
      sortBy: z.enum(['Score', 'Popularity', 'Rank', 'Episodes', 'Title']).optional().describe("Field to sort by"),
      sortDirection: z.enum(['asc', 'desc']).optional().describe("Sort direction"),
      limit: z.number().optional().describe("Maximum number of results to return"),
      
      // Logic options
      includeAllGenres: z.boolean().optional().describe("If true, anime must have ALL included genres; if false, anime needs ANY included genre (default: false)"),
    }),
    execute: async (params) => {
      try {
        const animeData = await loadAnimeData();
        
        let filteredData = [...animeData];
        
        // Helper function to check if any value in a comma-separated field matches the criteria
        const hasAnyValue = (fieldValue: string, values: string[]): boolean => {
          if (!fieldValue || !values.length) return false;
          const fieldItems = fieldValue.split(',').map(item => item.trim().toLowerCase());
          return values.some(value => 
            fieldItems.some(item => item.includes(value.toLowerCase()))
          );
        };
        
        const hasAllValues = (fieldValue: string, values: string[]): boolean => {
          if (!fieldValue || !values.length) return false;
          const fieldItems = fieldValue.split(',').map(item => item.trim().toLowerCase());
          return values.every(value => 
            fieldItems.some(item => item.includes(value.toLowerCase()))
          );
        };
        
        // Apply text search first
        if (params.searchQuery) {
          const query = params.searchQuery.toLowerCase();
          filteredData = filteredData.filter(anime => 
            anime.Title?.toLowerCase().includes(query) ||
            anime.English?.toLowerCase().includes(query) ||
            anime.Japanese?.toLowerCase().includes(query) ||
            anime.Description?.toLowerCase().includes(query) ||
            anime.Synonyms?.toLowerCase().includes(query)
          );
        }
        
        // Apply include filters
        if (params.includeGenres && params.includeGenres.length > 0) {
          if (params.includeAllGenres) {
            filteredData = filteredData.filter(anime => 
              hasAllValues(anime.Genres, params.includeGenres!)
            );
          } else {
            filteredData = filteredData.filter(anime => 
              hasAnyValue(anime.Genres, params.includeGenres!)
            );
          }
        }
        
        if (params.includeTypes && params.includeTypes.length > 0) {
          filteredData = filteredData.filter(anime => 
            params.includeTypes!.some(type => 
              anime.Type?.toLowerCase().includes(type.toLowerCase())
            )
          );
        }
        
        if (params.includeStatuses && params.includeStatuses.length > 0) {
          filteredData = filteredData.filter(anime => 
            params.includeStatuses!.some(status => 
              anime.Status?.toLowerCase().includes(status.toLowerCase())
            )
          );
        }
        
        if (params.includeStudios && params.includeStudios.length > 0) {
          filteredData = filteredData.filter(anime => 
            hasAnyValue(anime.Studios, params.includeStudios!)
          );
        }
        
        if (params.includeDemographics && params.includeDemographics.length > 0) {
          filteredData = filteredData.filter(anime => 
            params.includeDemographics!.some(demo => 
              anime.Demographic?.toLowerCase().includes(demo.toLowerCase())
            )
          );
        }
        
        if (params.includeSources && params.includeSources.length > 0) {
          filteredData = filteredData.filter(anime => 
            params.includeSources!.some(source => 
              anime.Source?.toLowerCase().includes(source.toLowerCase())
            )
          );
        }
        
        if (params.includeRatings && params.includeRatings.length > 0) {
          filteredData = filteredData.filter(anime => 
            params.includeRatings!.some(rating => 
              anime.Rating?.toLowerCase().includes(rating.toLowerCase())
            )
          );
        }
        
        // Apply exclude filters
        if (params.excludeGenres && params.excludeGenres.length > 0) {
          filteredData = filteredData.filter(anime => 
            !hasAnyValue(anime.Genres, params.excludeGenres!)
          );
        }
        
        if (params.excludeTypes && params.excludeTypes.length > 0) {
          filteredData = filteredData.filter(anime => 
            !params.excludeTypes!.some(type => 
              anime.Type?.toLowerCase().includes(type.toLowerCase())
            )
          );
        }
        
        if (params.excludeStatuses && params.excludeStatuses.length > 0) {
          filteredData = filteredData.filter(anime => 
            !params.excludeStatuses!.some(status => 
              anime.Status?.toLowerCase().includes(status.toLowerCase())
            )
          );
        }
        
        if (params.excludeStudios && params.excludeStudios.length > 0) {
          filteredData = filteredData.filter(anime => 
            !hasAnyValue(anime.Studios, params.excludeStudios!)
          );
        }
        
        if (params.excludeDemographics && params.excludeDemographics.length > 0) {
          filteredData = filteredData.filter(anime => 
            !params.excludeDemographics!.some(demo => 
              anime.Demographic?.toLowerCase().includes(demo.toLowerCase())
            )
          );
        }
        
        if (params.excludeSources && params.excludeSources.length > 0) {
          filteredData = filteredData.filter(anime => 
            !params.excludeSources!.some(source => 
              anime.Source?.toLowerCase().includes(source.toLowerCase())
            )
          );
        }
        
        if (params.excludeRatings && params.excludeRatings.length > 0) {
          filteredData = filteredData.filter(anime => 
            !params.excludeRatings!.some(rating => 
              anime.Rating?.toLowerCase().includes(rating.toLowerCase())
            )
          );
        }
        
        // Apply numeric filters
        if (params.minScore !== undefined) {
          filteredData = filteredData.filter(anime => 
            anime.Score !== null && anime.Score >= params.minScore!
          );
        }
        
        if (params.maxScore !== undefined) {
          filteredData = filteredData.filter(anime => 
            anime.Score !== null && anime.Score <= params.maxScore!
          );
        }
        
        if (params.minEpisodes !== undefined) {
          filteredData = filteredData.filter(anime => 
            anime.Episodes !== null && anime.Episodes >= params.minEpisodes!
          );
        }
        
        if (params.maxEpisodes !== undefined) {
          filteredData = filteredData.filter(anime => 
            anime.Episodes !== null && anime.Episodes <= params.maxEpisodes!
          );
        }
        
        // Apply date filters
        if (params.startYear || params.endYear) {
          filteredData = filteredData.filter(anime => {
            if (!anime.Aired) return false;
            const yearMatch = anime.Aired.match(/\d{4}/);
            if (!yearMatch) return false;
            
            const year = parseInt(yearMatch[0]);
            if (params.startYear && year < parseInt(params.startYear)) return false;
            if (params.endYear && year > parseInt(params.endYear)) return false;
            
            return true;
          });
        }
        
        // Apply sorting
        if (params.sortBy) {
          filteredData.sort((a, b) => {
            const aVal = a[params.sortBy!] as string | number | null;
            const bVal = b[params.sortBy!] as string | number | null;
            
            if (aVal === null && bVal === null) return 0;
            if (aVal === null) return params.sortDirection === 'asc' ? 1 : -1;
            if (bVal === null) return params.sortDirection === 'asc' ? -1 : 1;
            
            let comparison = 0;
            if (typeof aVal === 'number' && typeof bVal === 'number') {
              comparison = aVal - bVal;
            } else {
              comparison = String(aVal).localeCompare(String(bVal));
            }
            
            return params.sortDirection === 'asc' ? comparison : -comparison;
          });
        }
        
        // Apply limit
        if (params.limit) {
          filteredData = filteredData.slice(0, params.limit);
        }
        
        if (filteredData.length === 0) {
          return {
            success: false,
            message: "No anime found matching the specified inclusion/exclusion criteria",
            results: [],
            totalCount: 0
          };
        }
        
        return {
          success: true,
          message: `Found ${filteredData.length} anime matching the inclusion/exclusion criteria`,
          results: filteredData.map(anime => ({
            title: anime.Title,
            englishTitle: anime.English,
            score: anime.Score,
            rank: anime.Rank,
            popularity: anime.Popularity,
            episodes: anime.Episodes,
            type: anime.Type,
            status: anime.Status,
            genres: anime.Genres,
            studios: anime.Studios,
            demographic: anime.Demographic,
            rating: anime.Rating,
            source: anime.Source,
            description: anime.Description?.substring(0, 200) + (anime.Description?.length > 200 ? '...' : ''),
            year: anime.Aired?.match(/\d{4}/)?.[0] || 'Unknown',
            aired: anime.Aired
          })),
          totalCount: filteredData.length,
          appliedFilters: {
            included: Object.keys(params).filter(key => 
              key.startsWith('include') && params[key as keyof typeof params] && 
              Array.isArray(params[key as keyof typeof params]) && 
              (params[key as keyof typeof params] as unknown[]).length > 0
            ),
            excluded: Object.keys(params).filter(key => 
              key.startsWith('exclude') && params[key as keyof typeof params] && 
              Array.isArray(params[key as keyof typeof params]) && 
              (params[key as keyof typeof params] as unknown[]).length > 0
            )
          }
        };
      } catch (error) {
        return {
          success: false,
          message: "Failed to filter anime with inclusion/exclusion criteria",
          error: error instanceof Error ? error.message : String(error),
          results: []
        };
      }
    },
  }),

  getAnimeOptions: tool({
    description: "Get unique values for anime fields to populate dropdown filters and options",
    inputSchema: z.object({
      field: z.enum(['Genres', 'Studios', 'Producers', 'Type', 'Status', 'Source', 'Rating', 'Demographic', 'Premiered'])
        .describe("The field to get unique values for"),
    }),
    execute: async ({ field }) => {
      try {
        const animeData = await loadAnimeData();
        const uniqueValues = getUniqueValues(animeData, field);
        
        return {
          success: true,
          field,
          values: uniqueValues,
          count: uniqueValues.length,
          message: `Found ${uniqueValues.length} unique values for ${field}`
        };
      } catch (error) {
        return {
          success: false,
          field,
          values: [],
          error: error instanceof Error ? error.message : String(error),
          message: `Failed to get unique values for ${field}`
        };
      }
    },
  }),

  getAnimeStatistics: tool({
    description: "Get statistical information for numeric anime fields like score, episodes, rank, etc.",
    inputSchema: z.object({
      field: z.enum(['Score', 'Episodes', 'Rank', 'Popularity', 'Members'])
        .describe("The numeric field to get statistics for"),
    }),
    execute: async ({ field }) => {
      try {
        const animeData = await loadAnimeData();
        const stats = getFieldStatistics(animeData, field);
        
        if (!stats) {
          return {
            success: false,
            field,
            message: `No valid data found for field ${field}`,
            statistics: null
          };
        }
        
        return {
          success: true,
          field,
          statistics: {
            minimum: stats.min,
            maximum: stats.max,
            average: Math.round(stats.avg * 100) / 100, // Round to 2 decimal places
            count: stats.count,
            totalRecords: animeData.length
          },
          message: `Statistics calculated for ${stats.count} records with valid ${field} values`
        };
      } catch (error) {
        return {
          success: false,
          field,
          statistics: null,
          error: error instanceof Error ? error.message : String(error),
          message: `Failed to calculate statistics for ${field}`
        };
      }
    },
  }),

  findExactAnime: tool({
    description: "Find anime with exact title matching - searches for precise matches in Title, English, and Japanese fields",
    inputSchema: z.object({
      title: z.string().describe("The exact title of the anime to find (case-insensitive)"),
      matchAnyLanguage: z.boolean().optional().describe("Whether to match against Title, English, and Japanese fields (default: true)"),
    }),
    execute: async ({ title, matchAnyLanguage = true }) => {
      try {
        const animeData = await loadAnimeData();
        const searchTitle = title.toLowerCase().trim();
        
        let foundAnime: Anime | undefined;
        
        if (matchAnyLanguage) {
          // Search across all title fields
          foundAnime = animeData.find(anime => 
            anime.Title?.toLowerCase().trim() === searchTitle ||
            anime.English?.toLowerCase().trim() === searchTitle ||
            anime.Japanese?.toLowerCase().trim() === searchTitle
          );
        } else {
          // Search only the main Title field
          foundAnime = animeData.find(anime => 
            anime.Title?.toLowerCase().trim() === searchTitle
          );
        }
        
        if (!foundAnime) {
          return {
            success: false,
            message: `No anime found with exact title "${title}"`,
            anime: null,
            suggestions: animeData
              .filter(anime => 
                anime.Title?.toLowerCase().includes(searchTitle) ||
                anime.English?.toLowerCase().includes(searchTitle) ||
                anime.Japanese?.toLowerCase().includes(searchTitle)
              )
              .slice(0, 5)
              .map(anime => ({
                title: anime.Title,
                englishTitle: anime.English,
                japaneseTitle: anime.Japanese
              }))
          };
        }
        
        return {
          success: true,
          message: `Found exact match: ${foundAnime.Title}`,
          anime: {
            title: foundAnime.Title,
            englishTitle: foundAnime.English,
            japaneseTitle: foundAnime.Japanese,
            synonyms: foundAnime.Synonyms,
            description: foundAnime.Description,
            score: foundAnime.Score,
            rank: foundAnime.Rank,
            popularity: foundAnime.Popularity,
            members: foundAnime.Members,
            episodes: foundAnime.Episodes,
            type: foundAnime.Type,
            status: foundAnime.Status,
            aired: foundAnime.Aired,
            premiered: foundAnime.Premiered,
            broadcast: foundAnime.Broadcast,
            producers: foundAnime.Producers,
            licensors: foundAnime.Licensors,
            studios: foundAnime.Studios,
            source: foundAnime.Source,
            genres: foundAnime.Genres,
            demographic: foundAnime.Demographic,
            duration: foundAnime.Duration,
            rating: foundAnime.Rating
          }
        };
      } catch (error) {
        return {
          success: false,
          message: "Failed to search for exact anime match",
          error: error instanceof Error ? error.message : String(error),
          anime: null
        };
      }
    },
  }),

  getAnimeById: tool({
    description: "Get detailed information about a specific anime by searching for its title or ID",
    inputSchema: z.object({
      title: z.string().describe("The exact or partial title of the anime to find"),
      detailed: z.boolean().optional().describe("Whether to return detailed information (default: true)"),
    }),
    execute: async ({ title, detailed = true }) => {
      try {
        const animeData = await loadAnimeData();
        
        // First try exact title match (case insensitive)
        let anime = animeData.find(a => 
          a.Title.toLowerCase() === title.toLowerCase() ||
          a.English?.toLowerCase() === title.toLowerCase() ||
          a.Japanese?.toLowerCase() === title.toLowerCase()
        );
        
        // If no exact match, try partial match
        if (!anime) {
          anime = animeData.find(a => 
            a.Title.toLowerCase().includes(title.toLowerCase()) ||
            a.English?.toLowerCase().includes(title.toLowerCase()) ||
            a.Japanese?.toLowerCase().includes(title.toLowerCase())
          );
        }
        
        if (!anime) {
          return {
            success: false,
            message: `No anime found with title "${title}"`,
            anime: null
          };
        }
        
        const result = detailed ? {
          title: anime.Title,
          englishTitle: anime.English,
          japaneseTitle: anime.Japanese,
          synonyms: anime.Synonyms,
          description: anime.Description,
          score: anime.Score,
          rank: anime.Rank,
          popularity: anime.Popularity,
          members: anime.Members,
          episodes: anime.Episodes,
          type: anime.Type,
          status: anime.Status,
          aired: anime.Aired,
          premiered: anime.Premiered,
          broadcast: anime.Broadcast,
          producers: anime.Producers,
          licensors: anime.Licensors,
          studios: anime.Studios,
          source: anime.Source,
          genres: anime.Genres,
          demographic: anime.Demographic,
          duration: anime.Duration,
          rating: anime.Rating
        } : {
          title: anime.Title,
          englishTitle: anime.English,
          score: anime.Score,
          episodes: anime.Episodes,
          type: anime.Type,
          status: anime.Status,
          genres: anime.Genres,
          year: anime.Aired?.match(/\d{4}/)?.[0] || 'Unknown'
        };
        
        return {
          success: true,
          message: `Found anime: ${anime.Title}`,
          anime: result
        };
      } catch (error) {
        return {
          success: false,
          message: "Failed to retrieve anime data",
          error: error instanceof Error ? error.message : String(error),
          anime: null
        };
      }
    },
  }),
};
