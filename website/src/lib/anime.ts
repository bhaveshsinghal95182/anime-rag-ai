import MiniSearch from 'minisearch';
import { readFile } from 'fs/promises';
import path from 'path';

// Define the Anime interface
export interface Anime {
  Title: string;
  Score: number | null;
  Popularity: number | null;
  Rank: number | null;
  Members: number | null;
  Description: string;
  Synonyms: string;
  Japanese: string;
  English: string;
  Type: string; // e.g., TV, OVA, Movie
  Episodes: number | null;
  Status: string;
  Aired: string;
  Premiered: string;
  Broadcast: string;
  Producers: string;
  Licensors: string;
  Studios: string;
  Source: string;
  Genres: string;
  Demographic: string;
  Duration: string;
  Rating: string;
}

// Range filter type for numeric values
export interface RangeFilter {
  min?: number;
  max?: number;
}

// Comparison operators for numeric filters
export type ComparisonOperator = 'eq' | 'gt' | 'gte' | 'lt' | 'lte' | 'between';

// Numeric filter with comparison operator
export interface NumericFilter {
  operator: ComparisonOperator;
  value: number;
  secondValue?: number; // for 'between' operator
}

// Text filter options
export interface TextFilter {
  query: string;
  exact?: boolean; // exact match vs fuzzy search
  caseSensitive?: boolean;
}

// Multi-select filter for categorical values
export interface MultiSelectFilter {
  values: string[];
  matchAny?: boolean; // true = OR logic, false = AND logic
}

// Date range filter
export interface DateRangeFilter {
  start?: string; // ISO date string or date pattern
  end?: string;
}

// Sort options
export interface SortOption {
  field: keyof Anime;
  direction: 'asc' | 'desc';
}

// Complete filter configuration
export interface AnimeFilters {
  // Text-based fuzzy search
  search?: TextFilter;
  
  // Numeric filters
  score?: NumericFilter | RangeFilter;
  popularity?: NumericFilter | RangeFilter;
  rank?: NumericFilter | RangeFilter;
  members?: NumericFilter | RangeFilter;
  episodes?: NumericFilter | RangeFilter;
  
  // Categorical filters
  type?: MultiSelectFilter | string[];
  status?: MultiSelectFilter | string[];
  genres?: MultiSelectFilter | string[];
  demographic?: MultiSelectFilter | string[];
  studios?: MultiSelectFilter | string[];
  producers?: MultiSelectFilter | string[];
  source?: MultiSelectFilter | string[];
  rating?: MultiSelectFilter | string[];
  
  // Date filters
  aired?: DateRangeFilter;
  premiered?: MultiSelectFilter | string[];
  
  // Text filters for specific fields
  title?: TextFilter;
  english?: TextFilter;
  japanese?: TextFilter;
  description?: TextFilter;
  
  // Sorting
  sort?: SortOption[];
  
  // Pagination
  limit?: number;
  offset?: number;
}

// Filter context for chaining operations
export class AnimeFilterContext {
  private data: Anime[];
  private miniSearch: MiniSearch<Anime>;

  constructor(initialData: Anime[]) {
    this.data = initialData;
    this.miniSearch = new MiniSearch({
      fields: ['Title', 'English', 'Japanese', 'Description', 'Synonyms'],
      storeFields: ['Title', 'English', 'Japanese', 'Description'],
      searchOptions: {
        boost: { Title: 2, English: 2 },
        fuzzy: 0.2,
        prefix: true
      }
    });
    
    // Index the data for search
    this.miniSearch.addAll(initialData.map((anime, index) => ({ ...anime, id: index })));
  }

  // Get current filtered data
  getData(): Anime[] {
    return this.data;
  }

  // Apply filters and return new context
  filter(filters: AnimeFilters): AnimeFilterContext {
    let filteredData = [...this.data];

    // Apply fuzzy search first if provided
    if (filters.search) {
      const searchResults = this.miniSearch.search(filters.search.query, {
        fuzzy: !filters.search.exact ? 0.2 : false,
        prefix: !filters.search.exact
      });
      
      const searchIds = new Set(searchResults.map((result: { id: number }) => result.id));
      filteredData = filteredData.filter((_, index) => searchIds.has(index));
    }

    // Apply text filters for specific fields
    if (filters.title) {
      filteredData = this.applyTextFilter(filteredData, 'Title', filters.title);
    }
    if (filters.english) {
      filteredData = this.applyTextFilter(filteredData, 'English', filters.english);
    }
    if (filters.japanese) {
      filteredData = this.applyTextFilter(filteredData, 'Japanese', filters.japanese);
    }
    if (filters.description) {
      filteredData = this.applyTextFilter(filteredData, 'Description', filters.description);
    }

    // Apply numeric filters
    if (filters.score) {
      filteredData = this.applyNumericFilter(filteredData, 'Score', filters.score);
    }
    if (filters.popularity) {
      filteredData = this.applyNumericFilter(filteredData, 'Popularity', filters.popularity);
    }
    if (filters.rank) {
      filteredData = this.applyNumericFilter(filteredData, 'Rank', filters.rank);
    }
    if (filters.members) {
      filteredData = this.applyNumericFilter(filteredData, 'Members', filters.members);
    }
    if (filters.episodes) {
      filteredData = this.applyNumericFilter(filteredData, 'Episodes', filters.episodes);
    }

    // Apply categorical filters
    if (filters.type) {
      filteredData = this.applyCategoricalFilter(filteredData, 'Type', filters.type);
    }
    if (filters.status) {
      filteredData = this.applyCategoricalFilter(filteredData, 'Status', filters.status);
    }
    if (filters.genres) {
      filteredData = this.applyMultiValueFilter(filteredData, 'Genres', filters.genres);
    }
    if (filters.demographic) {
      filteredData = this.applyCategoricalFilter(filteredData, 'Demographic', filters.demographic);
    }
    if (filters.studios) {
      filteredData = this.applyMultiValueFilter(filteredData, 'Studios', filters.studios);
    }
    if (filters.producers) {
      filteredData = this.applyMultiValueFilter(filteredData, 'Producers', filters.producers);
    }
    if (filters.source) {
      filteredData = this.applyCategoricalFilter(filteredData, 'Source', filters.source);
    }
    if (filters.rating) {
      filteredData = this.applyCategoricalFilter(filteredData, 'Rating', filters.rating);
    }
    if (filters.premiered) {
      filteredData = this.applyCategoricalFilter(filteredData, 'Premiered', filters.premiered);
    }

    // Apply date filters
    if (filters.aired) {
      filteredData = this.applyDateFilter(filteredData, filters.aired);
    }

    // Apply sorting
    if (filters.sort && filters.sort.length > 0) {
      filteredData = this.applySorting(filteredData, filters.sort);
    }

    // Apply pagination
    if (filters.offset !== undefined || filters.limit !== undefined) {
      const offset = filters.offset || 0;
      const limit = filters.limit;
      filteredData = filteredData.slice(offset, limit ? offset + limit : undefined);
    }

    return new AnimeFilterContext(filteredData);
  }

  private applyTextFilter(data: Anime[], field: keyof Anime, filter: TextFilter): Anime[] {
    return data.filter(anime => {
      const value = anime[field]?.toString() || '';
      if (filter.exact) {
        return filter.caseSensitive 
          ? value === filter.query
          : value.toLowerCase() === filter.query.toLowerCase();
      } else {
        return filter.caseSensitive
          ? value.includes(filter.query)
          : value.toLowerCase().includes(filter.query.toLowerCase());
      }
    });
  }

  private applyNumericFilter(
    data: Anime[], 
    field: keyof Anime, 
    filter: NumericFilter | RangeFilter
  ): Anime[] {
    return data.filter(anime => {
      const value = anime[field] as number | null;
      if (value === null) return false;

      // Handle RangeFilter
      if ('min' in filter || 'max' in filter) {
        const rangeFilter = filter as RangeFilter;
        if (rangeFilter.min !== undefined && value < rangeFilter.min) return false;
        if (rangeFilter.max !== undefined && value > rangeFilter.max) return false;
        return true;
      }

      // Handle NumericFilter
      const numericFilter = filter as NumericFilter;
      switch (numericFilter.operator) {
        case 'eq': return value === numericFilter.value;
        case 'gt': return value > numericFilter.value;
        case 'gte': return value >= numericFilter.value;
        case 'lt': return value < numericFilter.value;
        case 'lte': return value <= numericFilter.value;
        case 'between': 
          return numericFilter.secondValue !== undefined 
            ? value >= numericFilter.value && value <= numericFilter.secondValue
            : false;
        default: return true;
      }
    });
  }

  private applyCategoricalFilter(
    data: Anime[], 
    field: keyof Anime, 
    filter: MultiSelectFilter | string[]
  ): Anime[] {
    const values = Array.isArray(filter) ? filter : filter.values;
    const matchAny = Array.isArray(filter) ? true : (filter.matchAny ?? true);

    return data.filter(anime => {
      const fieldValue = anime[field]?.toString() || '';
      
      if (matchAny) {
        return values.some(value => fieldValue.toLowerCase().includes(value.toLowerCase()));
      } else {
        return values.every(value => fieldValue.toLowerCase().includes(value.toLowerCase()));
      }
    });
  }

  private applyMultiValueFilter(
    data: Anime[], 
    field: keyof Anime, 
    filter: MultiSelectFilter | string[]
  ): Anime[] {
    const values = Array.isArray(filter) ? filter : filter.values;
    const matchAny = Array.isArray(filter) ? true : (filter.matchAny ?? true);

    return data.filter(anime => {
      const fieldValue = anime[field]?.toString() || '';
      const fieldItems = fieldValue.split(',').map(item => item.trim().toLowerCase());
      
      if (matchAny) {
        return values.some(value => 
          fieldItems.some(item => item.includes(value.toLowerCase()))
        );
      } else {
        return values.every(value => 
          fieldItems.some(item => item.includes(value.toLowerCase()))
        );
      }
    });
  }

  private applyDateFilter(data: Anime[], filter: DateRangeFilter): Anime[] {
    return data.filter(anime => {
      const airedValue = anime.Aired;
      if (!airedValue) return false;

      // Extract year from aired date (basic implementation)
      const yearMatch = airedValue.match(/\d{4}/);
      if (!yearMatch) return false;
      
      const year = parseInt(yearMatch[0]);
      
      if (filter.start) {
        const startYear = parseInt(filter.start);
        if (year < startYear) return false;
      }
      
      if (filter.end) {
        const endYear = parseInt(filter.end);
        if (year > endYear) return false;
      }
      
      return true;
    });
  }

  private applySorting(data: Anime[], sortOptions: SortOption[]): Anime[] {
    return [...data].sort((a, b) => {
      for (const sort of sortOptions) {
        const aVal = a[sort.field];
        const bVal = b[sort.field];
        
        // Handle null values
        if (aVal === null && bVal === null) continue;
        if (aVal === null) return sort.direction === 'asc' ? 1 : -1;
        if (bVal === null) return sort.direction === 'asc' ? -1 : 1;
        
        let comparison = 0;
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          comparison = aVal - bVal;
        } else {
          comparison = String(aVal).localeCompare(String(bVal));
        }
        
        if (comparison !== 0) {
          return sort.direction === 'asc' ? comparison : -comparison;
        }
      }
      return 0;
    });
  }
}

// Helper function to clean up duplicated values in comma-separated fields
// e.g., "AdventureAdventure,ComedyComedy" -> "Adventure,Comedy"
function cleanCommaSeparatedField(fieldValue: string): string {
  if (!fieldValue || fieldValue.trim() === '' || fieldValue === 'N/A') {
    return '';
  }
  
  const items = fieldValue.split(',').map(item => item.trim()).filter(item => item !== '');
  const cleanedItems = new Set<string>();
  
  for (const item of items) {
    let cleanedItem = item;
    
    // Check for simple duplicated words like "AdventureAdventure" -> "Adventure"
    // Pattern: same word repeated exactly
    const halfLength = Math.floor(item.length / 2);
    if (halfLength > 0 && item.substring(0, halfLength) === item.substring(halfLength)) {
      cleanedItem = item.substring(0, halfLength);
    } else {
      // Try splitting on capital letters for compound words
      const parts = item.split(/(?=[A-Z])/);
      if (parts.length % 2 === 0) {
        // Even number of parts, check if first half equals second half
        const firstHalf = parts.slice(0, parts.length / 2);
        const secondHalf = parts.slice(parts.length / 2);
        
        if (firstHalf.join('') === secondHalf.join('')) {
          cleanedItem = firstHalf.join('');
        }
      }
    }
    
    if (cleanedItem && cleanedItem !== 'N/A') {
      cleanedItems.add(cleanedItem);
    }
  }
  
  return Array.from(cleanedItems).join(', ');
}

// Utility functions for loading and filtering anime data
export async function loadAnimeData(): Promise<Anime[]> {
  try {
    const filePath = path.join(process.cwd(), 'src', 'lib', 'anime-data.json');
    const raw = await readFile(filePath, 'utf-8');
    const rawData = JSON.parse(raw) as Array<Record<string, unknown>>;

    // Transform string numbers to actual numbers and ensure required fields
    return rawData.map((item): Anime => {
      const base = {
        Title: (item.Title as string) ?? '',
        Description: (item.Description as string) ?? '',
        Synonyms: (item.Synonyms as string) ?? '',
        Japanese: (item.Japanese as string) ?? '',
        English: (item.English as string) ?? '',
        Type: (item.Type as string) ?? '',
        Status: (item.Status as string) ?? '',
        Aired: (item.Aired as string) ?? '',
        Premiered: (item.Premiered as string) ?? '',
        Broadcast: (item.Broadcast as string) ?? '',
        Producers: cleanCommaSeparatedField((item.Producers as string) ?? ''),
        Licensors: (item.Licensors as string) ?? '',
        Studios: cleanCommaSeparatedField((item.Studios as string) ?? ''),
        Source: (item.Source as string) ?? '',
        Genres: cleanCommaSeparatedField((item.Genres as string) ?? ''),
        Demographic: (item.Demographic as string) ?? '',
        Duration: (item.Duration as string) ?? '',
        Rating: (item.Rating as string) ?? '',
      };

      const toNumber = (v: unknown): number | null => {
        if (v === null || v === undefined) return null;
        if (typeof v === 'number') return v;
        const s = String(v).trim();
        if (s === '') return null;
        const n = Number(s.replace(/,/g, ''));
        return Number.isNaN(n) ? null : n;
      };

      return {
        ...base,
        Score: toNumber(item.Score),
        Popularity: toNumber(item.Popularity),
        Rank: toNumber(item.Rank),
        Members: toNumber(item.Members),
        Episodes: toNumber(item.Episodes),
      } as Anime;
    });
  } catch (error) {
    console.error('[loadAnimeData] Failed to load anime data:', error);
    return [];
  }
}

// Main filtering function
export function filterAnime(data: Anime[], filters: AnimeFilters): Anime[] | null {
  if (!data.length) return null;
  
  const context = new AnimeFilterContext(data);
  const result = context.filter(filters).getData();
  
  return result.length > 0 ? result : null;
}

// Convenience functions for specific filter types
export function searchAnimeByText(data: Anime[], query: string): Anime[] | null {
  return filterAnime(data, { search: { query } });
}

export function filterAnimeByGenre(data: Anime[], genres: string[]): Anime[] | null {
  return filterAnime(data, { genres });
}

export function filterAnimeByScore(data: Anime[], min?: number, max?: number): Anime[] | null {
  return filterAnime(data, { score: { min, max } });
}

export function filterAnimeByEpisodes(data: Anime[], min?: number, max?: number): Anime[] | null {
  return filterAnime(data, { episodes: { min, max } });
}

export function filterAnimeByType(data: Anime[], types: string[]): Anime[] | null {
  return filterAnime(data, { type: types });
}

export function filterAnimeByStatus(data: Anime[], statuses: string[]): Anime[] | null {
  return filterAnime(data, { status: statuses });
}

export function filterAnimeByYear(data: Anime[], startYear?: string, endYear?: string): Anime[] | null {
  return filterAnime(data, { aired: { start: startYear, end: endYear } });
}

// Chain multiple filters together
export function createFilterChain(data: Anime[]): AnimeFilterContext {
  return new AnimeFilterContext(data);
}

// Get unique values for dropdown filters
export function getUniqueValues(data: Anime[], field: keyof Anime): string[] {
  const values = new Set<string>();
  
  data.forEach(anime => {
    const value = anime[field];
    if (value) {
      if (field === 'Genres' || field === 'Studios' || field === 'Producers') {
        // Split comma-separated values
        value.toString().split(',').forEach(item => {
          const trimmed = item.trim();
          if (trimmed) values.add(trimmed);
        });
      } else {
        values.add(value.toString());
      }
    }
  });
  
  return Array.from(values).sort();
}

// Get statistics for numeric fields
export function getFieldStatistics(data: Anime[], field: keyof Anime): {
  min: number;
  max: number;
  avg: number;
  count: number;
} | null {
  const validValues = data
    .map(anime => anime[field])
    .filter((value): value is number => typeof value === 'number' && value !== null);
  
  if (validValues.length === 0) return null;
  
  const min = Math.min(...validValues);
  const max = Math.max(...validValues);
  const avg = validValues.reduce((sum, val) => sum + val, 0) / validValues.length;
  
  return { min, max, avg, count: validValues.length };
}
