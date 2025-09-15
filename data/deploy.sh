#!/bin/bash
# One-command MAL scraper deployment for GCP
# Run this once from your main user account: bash deploy_mal_scraper.sh

set -e
echo "🚀 Starting MAL Scraper deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%H:%M:%S')] ERROR: $1${NC}"
}

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    error "Don't run this script as root! Run as your normal user (descentkatil)"
    exit 1
fi

# Update system (will prompt for password once)
log "Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install dependencies
log "Installing dependencies..."
sudo apt install -y python3 python3-pip python3-venv git htop curl sqlite3 unzip

# Create scraper user and directories
log "Setting up scraper user and directories..."
sudo useradd -m -s /bin/bash scraper 2>/dev/null || warn "User 'scraper' already exists"
sudo mkdir -p /home/scraper/{mal_project,mal_data,mal_backups}
sudo chown -R scraper:scraper /home/scraper

# Setup Python environment
log "Setting up Python virtual environment..."
sudo -u scraper python3 -m venv /home/scraper/mal_project/venv
sudo -u scraper /home/scraper/mal_project/venv/bin/pip install --upgrade pip
sudo -u scraper /home/scraper/mal_project/venv/bin/pip install requests beautifulsoup4 pandas lxml flask pillow python-dateutil aiohttp asyncio

# Create the main scraper script
log "Creating comprehensive MAL scraper script..."
sudo -u scraper tee /home/scraper/mal_project/mal_scraper.py > /dev/null << 'SCRAPER_EOF'
#!/usr/bin/env python3
"""
Comprehensive MyAnimeList Scraper for GCP VPS
Scrapes ALL available data: anime, characters, staff, reviews, recommendations, statistics, etc.
"""

import requests
from bs4 import BeautifulSoup
import pandas as pd
import re
import time
import json
import logging
import os
import sys
from random import randint, uniform
from datetime import datetime, timedelta
from urllib.parse import urljoin, urlparse
import sqlite3
import signal
from pathlib import Path
import hashlib
from typing import Dict, List, Optional, Any

class Config:
    MIN_DELAY = 1
    MAX_DELAY = 2
    RATE_LIMIT_DELAY_MIN = 30
    RATE_LIMIT_DELAY_MAX = 60
    MAX_RETRIES = 3
    REQUEST_TIMEOUT = 20
    
    DATA_DIR = Path('/home/scraper/mal_data')
    BACKUP_DIR = Path('/home/scraper/mal_backups')
    LOG_FILE = '/home/scraper/mal_scraper.log'
    DB_FILE = '/home/scraper/mal_data.db'
    
    MAX_ANIME_TOTAL = None
    CHECKPOINT_FREQUENCY = 50
    
    # Scraping flags
    SCRAPE_CHARACTERS = True
    SCRAPE_STAFF = True
    SCRAPE_REVIEWS = True
    SCRAPE_RECOMMENDATIONS = True
    SCRAPE_STATISTICS = True
    SCRAPE_PICTURES = True
    SCRAPE_NEWS = True
    SCRAPE_CLUBS = True
    SCRAPE_EPISODES = True
    
    # Limits to prevent overwhelming
    MAX_REVIEWS_PER_ANIME = 100
    MAX_CHARACTERS_PER_ANIME = 50
    MAX_STAFF_PER_ANIME = 50
    MAX_PICTURES_PER_ANIME = 20

class ComprehensiveMALScraper:
    def __init__(self):
        self.setup_directories()
        self.setup_logging()
        self.setup_database()
        self.setup_session()
        
        self.scraped_count = 0
        self.start_time = datetime.now()
        
        signal.signal(signal.SIGINT, self.signal_handler)
        signal.signal(signal.SIGTERM, self.signal_handler)
        
        self.logger.info("Comprehensive MAL Scraper initialized")
    
    def setup_directories(self):
        Config.DATA_DIR.mkdir(parents=True, exist_ok=True)
        Config.BACKUP_DIR.mkdir(parents=True, exist_ok=True)
        (Config.DATA_DIR / 'images').mkdir(exist_ok=True)
        (Config.DATA_DIR / 'exports').mkdir(exist_ok=True)
    
    def setup_logging(self):
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(Config.LOG_FILE),
                logging.StreamHandler(sys.stdout)
            ]
        )
        self.logger = logging.getLogger(__name__)
        self.logger.info(f"Starting Comprehensive MAL Scraper on {os.uname().nodename}")
    
    def setup_database(self):
        self.conn = sqlite3.connect(Config.DB_FILE)
        
        # Enhanced anime table
        self.conn.execute('''
            CREATE TABLE IF NOT EXISTS anime_data (
                id INTEGER PRIMARY KEY,
                mal_id INTEGER UNIQUE,
                url TEXT UNIQUE,
                title TEXT,
                title_english TEXT,
                title_japanese TEXT,
                title_synonyms TEXT,
                score REAL,
                score_count INTEGER,
                popularity INTEGER,
                rank INTEGER,
                members INTEGER,
                favorites INTEGER,
                description TEXT,
                type TEXT,
                episodes INTEGER,
                status TEXT,
                aired_from TEXT,
                aired_to TEXT,
                premiered TEXT,
                broadcast TEXT,
                producers TEXT,
                licensors TEXT,
                studios TEXT,
                source TEXT,
                genres TEXT,
                themes TEXT,
                demographics TEXT,
                duration INTEGER,
                rating TEXT,
                trailer_url TEXT,
                background TEXT,
                related_anime TEXT,
                opening_themes TEXT,
                ending_themes TEXT,
                external_links TEXT,
                image_url TEXT,
                scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Characters table
        self.conn.execute('''
            CREATE TABLE IF NOT EXISTS characters (
                id INTEGER PRIMARY KEY,
                mal_id INTEGER,
                anime_mal_id INTEGER,
                name TEXT,
                name_kanji TEXT,
                description TEXT,
                role TEXT,
                image_url TEXT,
                favorites INTEGER,
                member_favorites INTEGER,
                about TEXT,
                voice_actors TEXT,
                scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (anime_mal_id) REFERENCES anime_data (mal_id)
            )
        ''')
        
        # Staff table
        self.conn.execute('''
            CREATE TABLE IF NOT EXISTS staff (
                id INTEGER PRIMARY KEY,
                mal_id INTEGER,
                anime_mal_id INTEGER,
                name TEXT,
                role TEXT,
                image_url TEXT,
                given_name TEXT,
                family_name TEXT,
                alternate_names TEXT,
                birthday TEXT,
                about TEXT,
                favorites INTEGER,
                scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (anime_mal_id) REFERENCES anime_data (mal_id)
            )
        ''')
        
        # Reviews table
        self.conn.execute('''
            CREATE TABLE IF NOT EXISTS reviews (
                id INTEGER PRIMARY KEY,
                anime_mal_id INTEGER,
                reviewer_name TEXT,
                reviewer_image TEXT,
                review_date TEXT,
                episodes_watched INTEGER,
                overall_score INTEGER,
                story_score INTEGER,
                animation_score INTEGER,
                sound_score INTEGER,
                character_score INTEGER,
                enjoyment_score INTEGER,
                review_text TEXT,
                helpful_count INTEGER,
                scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (anime_mal_id) REFERENCES anime_data (mal_id)
            )
        ''')
        
        # Recommendations table
        self.conn.execute('''
            CREATE TABLE IF NOT EXISTS recommendations (
                id INTEGER PRIMARY KEY,
                anime_mal_id INTEGER,
                recommended_anime_id INTEGER,
                recommended_title TEXT,
                recommendation_count INTEGER,
                description TEXT,
                scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (anime_mal_id) REFERENCES anime_data (mal_id)
            )
        ''')
        
        # Statistics table
        self.conn.execute('''
            CREATE TABLE IF NOT EXISTS statistics (
                id INTEGER PRIMARY KEY,
                anime_mal_id INTEGER,
                watching INTEGER,
                completed INTEGER,
                on_hold INTEGER,
                dropped INTEGER,
                plan_to_watch INTEGER,
                score_10 INTEGER,
                score_9 INTEGER,
                score_8 INTEGER,
                score_7 INTEGER,
                score_6 INTEGER,
                score_5 INTEGER,
                score_4 INTEGER,
                score_3 INTEGER,
                score_2 INTEGER,
                score_1 INTEGER,
                scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (anime_mal_id) REFERENCES anime_data (mal_id)
            )
        ''')
        
        # Pictures table
        self.conn.execute('''
            CREATE TABLE IF NOT EXISTS pictures (
                id INTEGER PRIMARY KEY,
                anime_mal_id INTEGER,
                image_url TEXT,
                image_type TEXT,
                local_path TEXT,
                scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (anime_mal_id) REFERENCES anime_data (mal_id)
            )
        ''')
        
        # News table
        self.conn.execute('''
            CREATE TABLE IF NOT EXISTS news (
                id INTEGER PRIMARY KEY,
                anime_mal_id INTEGER,
                title TEXT,
                url TEXT,
                author TEXT,
                date TEXT,
                summary TEXT,
                image_url TEXT,
                scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (anime_mal_id) REFERENCES anime_data (mal_id)
            )
        ''')
        
        # Episodes table
        self.conn.execute('''
            CREATE TABLE IF NOT EXISTS episodes (
                id INTEGER PRIMARY KEY,
                anime_mal_id INTEGER,
                episode_number INTEGER,
                title TEXT,
                title_japanese TEXT,
                title_romanji TEXT,
                aired_date TEXT,
                score REAL,
                votes INTEGER,
                discussion_url TEXT,
                scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (anime_mal_id) REFERENCES anime_data (mal_id)
            )
        ''')
        
        # Create indexes
        indexes = [
            'CREATE INDEX IF NOT EXISTS idx_anime_mal_id ON anime_data(mal_id)',
            'CREATE INDEX IF NOT EXISTS idx_anime_url ON anime_data(url)',
            'CREATE INDEX IF NOT EXISTS idx_characters_anime ON characters(anime_mal_id)',
            'CREATE INDEX IF NOT EXISTS idx_staff_anime ON staff(anime_mal_id)',
            'CREATE INDEX IF NOT EXISTS idx_reviews_anime ON reviews(anime_mal_id)',
            'CREATE INDEX IF NOT EXISTS idx_recommendations_anime ON recommendations(anime_mal_id)',
            'CREATE INDEX IF NOT EXISTS idx_statistics_anime ON statistics(anime_mal_id)',
            'CREATE INDEX IF NOT EXISTS idx_pictures_anime ON pictures(anime_mal_id)',
            'CREATE INDEX IF NOT EXISTS idx_news_anime ON news(anime_mal_id)',
            'CREATE INDEX IF NOT EXISTS idx_episodes_anime ON episodes(anime_mal_id)'
        ]
        
        for index in indexes:
            self.conn.execute(index)
        
        self.conn.commit()
        
        cursor = self.conn.execute('SELECT COUNT(*) FROM anime_data')
        self.scraped_count = cursor.fetchone()[0]
        self.logger.info(f"Database initialized. Existing anime records: {self.scraped_count}")
    
    def setup_session(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        })
    
    def signal_handler(self, signum, frame):
        self.logger.info(f"Received signal {signum}. Shutting down gracefully...")
        self.save_checkpoint()
        self.export_all_data()
        sys.exit(0)
    
    def smart_delay(self):
        delay = uniform(Config.MIN_DELAY, Config.MAX_DELAY)
        time.sleep(delay)
    
    def safe_request(self, url):
        for attempt in range(Config.MAX_RETRIES):
            try:
                response = self.session.get(url, timeout=Config.REQUEST_TIMEOUT)
                if response.status_code == 200:
                    return response
                elif response.status_code == 429:
                    delay = randint(Config.RATE_LIMIT_DELAY_MIN, Config.RATE_LIMIT_DELAY_MAX)
                    self.logger.warning(f"Rate limited. Waiting {delay}s")
                    time.sleep(delay)
                elif response.status_code == 404:
                    self.logger.warning(f"404 Not Found: {url}")
                    return None
                    
            except Exception as e:
                self.logger.error(f"Request error for {url}: {e}")
                if attempt < Config.MAX_RETRIES - 1:
                    time.sleep(2 ** attempt)
        return None
    
    def extract_mal_id(self, url):
        """Extract MAL ID from URL"""
        match = re.search(r'/anime/(\d+)', url)
        return int(match.group(1)) if match else None
    
    def is_already_scraped(self, url):
        mal_id = self.extract_mal_id(url)
        if not mal_id:
            return False
        cursor = self.conn.execute('SELECT 1 FROM anime_data WHERE mal_id = ?', (mal_id,))
        return cursor.fetchone() is not None
    
    def extract_comprehensive_anime_data(self, url):
        """Extract all available data for an anime"""
        mal_id = self.extract_mal_id(url)
        if not mal_id:
            return False
            
        if self.is_already_scraped(url):
            self.logger.info(f"Already scraped: {url}")
            return True
        
        response = self.safe_request(url)
        if not response:
            return False
        
        try:
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Extract main anime data
            anime_data = self.extract_main_anime_data(soup, url, mal_id)
            if not anime_data:
                return False
            
            # Insert main anime data
            self.insert_anime_data(anime_data)
            
            # Extract additional data if enabled
            if Config.SCRAPE_CHARACTERS:
                self.scrape_anime_characters(mal_id)
                
            if Config.SCRAPE_STAFF:
                self.scrape_anime_staff(mal_id)
                
            if Config.SCRAPE_REVIEWS:
                self.scrape_anime_reviews(mal_id)
                
            if Config.SCRAPE_RECOMMENDATIONS:
                self.scrape_anime_recommendations(mal_id)
                
            if Config.SCRAPE_STATISTICS:
                self.scrape_anime_statistics(mal_id)
                
            if Config.SCRAPE_PICTURES:
                self.scrape_anime_pictures(mal_id)
                
            if Config.SCRAPE_NEWS:
                self.scrape_anime_news(mal_id)
                
            if Config.SCRAPE_EPISODES:
                self.scrape_anime_episodes(mal_id)
            
            self.scraped_count += 1
            self.logger.info(f"Comprehensive scrape [{self.scraped_count}]: {anime_data.get('title', 'Unknown')}")
            
            if self.scraped_count % Config.CHECKPOINT_FREQUENCY == 0:
                self.save_checkpoint()
            
            return True
            
        except Exception as e:
            self.logger.error(f"Error extracting comprehensive data for {url}: {e}")
            return False
    
    def extract_main_anime_data(self, soup, url, mal_id):
        """Extract main anime information from the page"""
        try:
            # Title extraction
            title_elem = soup.find('h1', class_='title-name')
            title = title_elem.text.strip() if title_elem else 'N/A'
            
            # English and Japanese titles
            title_english = 'N/A'
            title_japanese = 'N/A'
            title_synonyms = 'N/A'
            
            # Extract from information section
            info_section = soup.find('td', class_='borderClass')
            if info_section:
                for row in info_section.find_all('div', class_='spaceit_pad'):
                    text = row.get_text(strip=True)
                    if 'English:' in text:
                        title_english = text.split('English:', 1)[1].strip()
                    elif 'Japanese:' in text:
                        title_japanese = text.split('Japanese:', 1)[1].strip()
                    elif 'Synonyms:' in text:
                        title_synonyms = text.split('Synonyms:', 1)[1].strip()
            
            # Score and statistics
            score_elem = soup.find('div', class_='fl-l score')
            score = None
            if score_elem:
                score_text = score_elem.find('div', class_='score-label')
                if score_text:
                    try:
                        score = float(score_text.text.strip())
                    except ValueError:
                        score = None
            
            # Score count
            score_count_elem = soup.find('div', class_='fl-l score')
            score_count = None
            if score_count_elem:
                count_elem = score_count_elem.find('div', attrs={'itemprop': 'ratingCount'})
                if count_elem:
                    score_count = self.extract_number(count_elem)
            
            # Extract popularity, rank, members, favorites
            popularity = self.extract_number(soup.find('span', class_="numbers popularity"))
            rank = self.extract_number(soup.find('span', class_="numbers ranked"))
            members = self.extract_number(soup.find('span', class_="numbers members"))
            favorites = self.extract_number(soup.find('span', class_="numbers favorites"))
            
            # Description
            desc_elem = soup.find('p', attrs={"itemprop": "description"})
            description = desc_elem.get_text(strip=True) if desc_elem else 'N/A'
            
            # Background information
            background = 'N/A'
            bg_elem = soup.find('h2', string='Background')
            if bg_elem and bg_elem.find_next_sibling():
                background = bg_elem.find_next_sibling().get_text(strip=True)
            
            # Image URL
            image_url = 'N/A'
            img_elem = soup.find('img', attrs={'itemprop': 'image'})
            if img_elem:
                image_url = img_elem.get('data-src') or img_elem.get('src', 'N/A')
            
            # Trailer URL
            trailer_url = 'N/A'
            trailer_elem = soup.find('a', class_='iframe js-fancybox-video')
            if trailer_elem:
                trailer_url = trailer_elem.get('href', 'N/A')
            
            # Extract detailed information from sidebar
            info_fields = {
                'type': 'N/A', 'episodes': None, 'status': 'N/A',
                'aired_from': 'N/A', 'aired_to': 'N/A', 'premiered': 'N/A',
                'broadcast': 'N/A', 'producers': 'N/A', 'licensors': 'N/A',
                'studios': 'N/A', 'source': 'N/A', 'genres': 'N/A',
                'themes': 'N/A', 'demographics': 'N/A', 'duration': None,
                'rating': 'N/A'
            }
            
            sidebar_divs = soup.find_all('div', class_='spaceit_pad')
            for div in sidebar_divs:
                text = div.get_text(strip=True)
                if ':' in text:
                    parts = text.split(':', 1)
                    if len(parts) == 2:
                        key = parts[0].strip().lower().replace(' ', '_')
                        value = parts[1].strip()
                        
                        if key == 'type':
                            info_fields['type'] = value
                        elif key == 'episodes':
                            info_fields['episodes'] = self.extract_number_from_text(value)
                        elif key == 'status':
                            info_fields['status'] = value
                        elif key == 'aired':
                            # Split aired date range
                            if 'to' in value:
                                dates = value.split('to')
                                info_fields['aired_from'] = dates[0].strip()
                                info_fields['aired_to'] = dates[1].strip()
                            else:
                                info_fields['aired_from'] = value
                        elif key in info_fields:
                            info_fields[key] = value
            
            # Extract genres, themes, demographics
            genre_links = soup.find_all('span', attrs={'itemprop': 'genre'})
            if genre_links:
                info_fields['genres'] = ', '.join([g.text.strip() for g in genre_links])
            
            # Opening and ending themes
            opening_themes = self.extract_themes(soup, 'Opening Theme')
            ending_themes = self.extract_themes(soup, 'Ending Theme')
            
            # Related anime
            related_anime = self.extract_related_anime(soup)
            
            # External links
            external_links = self.extract_external_links(soup)
            
            return {
                'mal_id': mal_id,
                'url': url,
                'title': title,
                'title_english': title_english,
                'title_japanese': title_japanese,
                'title_synonyms': title_synonyms,
                'score': score,
                'score_count': score_count,
                'popularity': popularity,
                'rank': rank,
                'members': members,
                'favorites': favorites,
                'description': description,
                'background': background,
                'image_url': image_url,
                'trailer_url': trailer_url,
                'opening_themes': json.dumps(opening_themes),
                'ending_themes': json.dumps(ending_themes),
                'related_anime': json.dumps(related_anime),
                'external_links': json.dumps(external_links),
                **info_fields
            }
            
        except Exception as e:
            self.logger.error(f"Error extracting main anime data: {e}")
            return None
    
    def extract_number(self, element):
        if not element:
            return None
        text = element.text.replace(',', '').replace('#', '')
        match = re.search(r'(\d+)', text)
        return int(match.group(1)) if match else None
    
    def extract_number_from_text(self, text):
        if not text or text.strip().lower() in ['unknown', 'n/a', '-']:
            return None
        numbers = re.findall(r'\d+', text.replace(',', ''))
        return int(numbers[0]) if numbers else None
    
    def extract_themes(self, soup, theme_type):
        """Extract opening/ending themes"""
        themes = []
        theme_header = soup.find('h2', string=f'{theme_type}s')
        if not theme_header:
            theme_header = soup.find('h2', string=theme_type)
        
        if theme_header:
            theme_list = theme_header.find_next_sibling('div', class_='theme-songs')
            if theme_list:
                for song in theme_list.find_all('span', class_='theme-song'):
                    themes.append(song.get_text(strip=True))
        
        return themes
    
    def extract_related_anime(self, soup):
        """Extract related anime information"""
        related = {}
        related_section = soup.find('table', class_='anime_detail_related_anime')
        if related_section:
            for row in related_section.find_all('tr'):
                cells = row.find_all('td')
                if len(cells) >= 2:
                    relation_type = cells[0].get_text(strip=True).replace(':', '')
                    anime_links = cells[1].find_all('a')
                    related[relation_type] = []
                    for link in anime_links:
                        related[relation_type].append({
                            'title': link.get_text(strip=True),
                            'url': link.get('href', '')
                        })
        return related
    
    def extract_external_links(self, soup):
        """Extract external links"""
        links = []
        external_section = soup.find('div', class_='external_links')
        if external_section:
            for link in external_section.find_all('a'):
                links.append({
                    'title': link.get_text(strip=True),
                    'url': link.get('href', '')
                })
        return links
    
    def insert_anime_data(self, anime_data):
        """Insert anime data into database"""
        self.conn.execute('''
            INSERT OR REPLACE INTO anime_data 
            (mal_id, url, title, title_english, title_japanese, title_synonyms,
             score, score_count, popularity, rank, members, favorites, description,
             background, image_url, trailer_url, opening_themes, ending_themes,
             related_anime, external_links, type, episodes, status, aired_from,
             aired_to, premiered, broadcast, producers, licensors, studios,
             source, genres, themes, demographics, duration, rating)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            anime_data['mal_id'], anime_data['url'], anime_data['title'],
            anime_data['title_english'], anime_data['title_japanese'], anime_data['title_synonyms'],
            anime_data['score'], anime_data['score_count'], anime_data['popularity'],
            anime_data['rank'], anime_data['members'], anime_data['favorites'],
            anime_data['description'], anime_data['background'], anime_data['image_url'],
            anime_data['trailer_url'], anime_data['opening_themes'], anime_data['ending_themes'],
            anime_data['related_anime'], anime_data['external_links'], anime_data['type'],
            anime_data['episodes'], anime_data['status'], anime_data['aired_from'],
            anime_data['aired_to'], anime_data['premiered'], anime_data['broadcast'],
            anime_data['producers'], anime_data['licensors'], anime_data['studios'],
            anime_data['source'], anime_data['genres'], anime_data['themes'],
            anime_data['demographics'], anime_data['duration'], anime_data['rating']
        ))
        self.conn.commit()
    
    def scrape_anime_characters(self, mal_id):
        """Scrape character information for an anime"""
        characters_url = f'https://myanimelist.net/anime/{mal_id}/characters'
        response = self.safe_request(characters_url)
        if not response:
            return
        
        try:
            soup = BeautifulSoup(response.text, 'html.parser')
            character_containers = soup.find_all('div', class_='character-container')
            
            for i, container in enumerate(character_containers[:Config.MAX_CHARACTERS_PER_ANIME]):
                try:
                    # Character basic info
                    char_link = container.find('a', href=re.compile(r'/character/\d+'))
                    if not char_link:
                        continue
                    
                    char_mal_id = self.extract_mal_id_from_url(char_link.get('href', ''), 'character')
                    char_name = char_link.find('h3')
                    char_name = char_name.text.strip() if char_name else 'N/A'
                    
                    # Character image
                    char_img = container.find('img')
                    char_image_url = char_img.get('data-src') or char_img.get('src', 'N/A') if char_img else 'N/A'
                    
                    # Character role
                    role_elem = container.find('div', class_='character-role')
                    role = role_elem.text.strip() if role_elem else 'N/A'
                    
                    # Voice actors
                    va_section = container.find('div', class_='voice-actors')
                    voice_actors = []
                    if va_section:
                        for va in va_section.find_all('a', href=re.compile(r'/people/\d+')):
                            va_name = va.find('div', class_='name')
                            va_lang = va.find('div', class_='language')
                            if va_name:
                                voice_actors.append({
                                    'name': va_name.text.strip(),
                                    'language': va_lang.text.strip() if va_lang else 'N/A'
                                })
                    
                    # Get detailed character info
                    char_details = self.get_character_details(char_mal_id)
                    
                    # Insert character data
                    self.conn.execute('''
                        INSERT OR REPLACE INTO characters
                        (mal_id, anime_mal_id, name, name_kanji, description, role,
                         image_url, favorites, member_favorites, about, voice_actors)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        char_mal_id, mal_id, char_name,
                        char_details.get('name_kanji', 'N/A'),
                        char_details.get('description', 'N/A'),
                        role, char_image_url,
                        char_details.get('favorites', None),
                        char_details.get('member_favorites', None),
                        char_details.get('about', 'N/A'),
                        json.dumps(voice_actors)
                    ))
                    
                except Exception as e:
                    self.logger.error(f"Error scraping character {i}: {e}")
                    continue
            
            self.conn.commit()
            self.logger.info(f"Scraped characters for anime {mal_id}")
            
        except Exception as e:
            self.logger.error(f"Error scraping characters for anime {mal_id}: {e}")
    
    def scrape_anime_staff(self, mal_id):
        """Scrape staff information for an anime"""
        staff_url = f'https://myanimelist.net/anime/{mal_id}/characters'
        response = self.safe_request(staff_url)
        if not response:
            return
        
        try:
            soup = BeautifulSoup(response.text, 'html.parser')
            staff_section = soup.find('div', class_='anime-staff')
            if not staff_section:
                return
            
            staff_containers = staff_section.find_all('div', class_='staff-container')
            
            for i, container in enumerate(staff_containers[:Config.MAX_STAFF_PER_ANIME]):
                try:
                    # Staff basic info
                    staff_link = container.find('a', href=re.compile(r'/people/\d+'))
                    if not staff_link:
                        continue
                    
                    staff_mal_id = self.extract_mal_id_from_url(staff_link.get('href', ''), 'people')
                    staff_name = staff_link.find('div', class_='name')
                    staff_name = staff_name.text.strip() if staff_name else 'N/A'
                    
                    # Staff image
                    staff_img = container.find('img')
                    staff_image_url = staff_img.get('data-src') or staff_img.get('src', 'N/A') if staff_img else 'N/A'
                    
                    # Staff role
                    role_elem = container.find('div', class_='role')
                    role = role_elem.text.strip() if role_elem else 'N/A'
                    
                    # Get detailed staff info
                    staff_details = self.get_staff_details(staff_mal_id)
                    
                    # Insert staff data
                    self.conn.execute('''
                        INSERT OR REPLACE INTO staff
                        (mal_id, anime_mal_id, name, role, image_url, given_name,
                         family_name, alternate_names, birthday, about, favorites)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        staff_mal_id, mal_id, staff_name, role, staff_image_url,
                        staff_details.get('given_name', 'N/A'),
                        staff_details.get('family_name', 'N/A'),
                        staff_details.get('alternate_names', 'N/A'),
                        staff_details.get('birthday', 'N/A'),
                        staff_details.get('about', 'N/A'),
                        staff_details.get('favorites', None)
                    ))
                    
                except Exception as e:
                    self.logger.error(f"Error scraping staff {i}: {e}")
                    continue
            
            self.conn.commit()
            self.logger.info(f"Scraped staff for anime {mal_id}")
            
        except Exception as e:
            self.logger.error(f"Error scraping staff for anime {mal_id}: {e}")
    
    def scrape_anime_reviews(self, mal_id):
        """Scrape reviews for an anime"""
        reviews_url = f'https://myanimelist.net/anime/{mal_id}/reviews'
        response = self.safe_request(reviews_url)
        if not response:
            return
        
        try:
            soup = BeautifulSoup(response.text, 'html.parser')
            review_containers = soup.find_all('div', class_='review-element')
            
            for i, container in enumerate(review_containers[:Config.MAX_REVIEWS_PER_ANIME]):
                try:
                    # Reviewer info
                    reviewer_elem = container.find('div', class_='reviewer')
                    reviewer_name = 'N/A'
                    reviewer_image = 'N/A'
                    if reviewer_elem:
                        name_elem = reviewer_elem.find('a')
                        if name_elem:
                            reviewer_name = name_elem.text.strip()
                        img_elem = reviewer_elem.find('img')
                        if img_elem:
                            reviewer_image = img_elem.get('data-src') or img_elem.get('src', 'N/A')
                    
                    # Review date
                    date_elem = container.find('div', class_='update_at')
                    review_date = date_elem.text.strip() if date_elem else 'N/A'
                    
                    # Episodes watched
                    eps_elem = container.find('div', class_='episodes')
                    episodes_watched = None
                    if eps_elem:
                        eps_text = eps_elem.text
                        episodes_watched = self.extract_number_from_text(eps_text)
                    
                    # Scores
                    scores = {}
                    score_section = container.find('div', class_='scores')
                    if score_section:
                        for score_elem in score_section.find_all('div', class_='score'):
                            score_type = score_elem.find('span', class_='score-label')
                            score_value = score_elem.find('span', class_='score-value')
                            if score_type and score_value:
                                scores[score_type.text.strip().lower()] = self.extract_number_from_text(score_value.text)
                    
                    # Review text
                    text_elem = container.find('div', class_='text')
                    review_text = text_elem.get_text(strip=True) if text_elem else 'N/A'
                    
                    # Helpful count
                    helpful_elem = container.find('span', class_='helpful-count')
                    helpful_count = self.extract_number_from_text(helpful_elem.text) if helpful_elem else None
                    
                    # Insert review data
                    self.conn.execute('''
                        INSERT OR REPLACE INTO reviews
                        (anime_mal_id, reviewer_name, reviewer_image, review_date,
                         episodes_watched, overall_score, story_score, animation_score,
                         sound_score, character_score, enjoyment_score, review_text, helpful_count)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        mal_id, reviewer_name, reviewer_image, review_date, episodes_watched,
                        scores.get('overall', None), scores.get('story', None),
                        scores.get('animation', None), scores.get('sound', None),
                        scores.get('character', None), scores.get('enjoyment', None),
                        review_text, helpful_count
                    ))
                    
                except Exception as e:
                    self.logger.error(f"Error scraping review {i}: {e}")
                    continue
            
            self.conn.commit()
            self.logger.info(f"Scraped reviews for anime {mal_id}")
            
        except Exception as e:
            self.logger.error(f"Error scraping reviews for anime {mal_id}: {e}")
    
    def scrape_anime_recommendations(self, mal_id):
        """Scrape recommendations for an anime"""
        recs_url = f'https://myanimelist.net/anime/{mal_id}/userrecs'
        response = self.safe_request(recs_url)
        if not response:
            return
        
        try:
            soup = BeautifulSoup(response.text, 'html.parser')
            rec_containers = soup.find_all('div', class_='recommendation-item')
            
            for container in rec_containers:
                try:
                    # Recommended anime
                    anime_link = container.find('a', href=re.compile(r'/anime/\d+'))
                    if not anime_link:
                        continue
                    
                    rec_anime_id = self.extract_mal_id_from_url(anime_link.get('href', ''), 'anime')
                    rec_title = anime_link.text.strip()
                    
                    # Recommendation count
                    count_elem = container.find('span', class_='rec-count')
                    rec_count = self.extract_number_from_text(count_elem.text) if count_elem else None
                    
                    # Description
                    desc_elem = container.find('div', class_='rec-description')
                    description = desc_elem.get_text(strip=True) if desc_elem else 'N/A'
                    
                    # Insert recommendation data
                    self.conn.execute('''
                        INSERT OR REPLACE INTO recommendations
                        (anime_mal_id, recommended_anime_id, recommended_title,
                         recommendation_count, description)
                        VALUES (?, ?, ?, ?, ?)
                    ''', (mal_id, rec_anime_id, rec_title, rec_count, description))
                    
                except Exception as e:
                    self.logger.error(f"Error scraping recommendation: {e}")
                    continue
            
            self.conn.commit()
            self.logger.info(f"Scraped recommendations for anime {mal_id}")
            
        except Exception as e:
            self.logger.error(f"Error scraping recommendations for anime {mal_id}: {e}")
    
    def scrape_anime_statistics(self, mal_id):
        """Scrape statistics for an anime"""
        stats_url = f'https://myanimelist.net/anime/{mal_id}/stats'
        response = self.safe_request(stats_url)
        if not response:
            return
        
        try:
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Status statistics
            status_stats = {}
            status_section = soup.find('div', class_='status-stats')
            if status_section:
                for stat in status_section.find_all('li'):
                    label = stat.find('span', class_='label')
                    value = stat.find('span', class_='value')
                    if label and value:
                        status_stats[label.text.strip().lower().replace(' ', '_')] = self.extract_number_from_text(value.text)
            
            # Score distribution
            score_stats = {}
            score_section = soup.find('table', class_='score-stats')
            if score_section:
                for row in score_section.find_all('tr'):
                    cells = row.find_all('td')
                    if len(cells) >= 2:
                        score = cells[0].text.strip()
                        count = self.extract_number_from_text(cells[1].text)
                        if score.isdigit():
                            score_stats[f'score_{score}'] = count
            
            # Insert statistics data
            self.conn.execute('''
                INSERT OR REPLACE INTO statistics
                (anime_mal_id, watching, completed, on_hold, dropped, plan_to_watch,
                 score_10, score_9, score_8, score_7, score_6, score_5,
                 score_4, score_3, score_2, score_1)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                mal_id,
                status_stats.get('watching', None),
                status_stats.get('completed', None),
                status_stats.get('on_hold', None),
                status_stats.get('dropped', None),
                status_stats.get('plan_to_watch', None),
                score_stats.get('score_10', None),
                score_stats.get('score_9', None),
                score_stats.get('score_8', None),
                score_stats.get('score_7', None),
                score_stats.get('score_6', None),
                score_stats.get('score_5', None),
                score_stats.get('score_4', None),
                score_stats.get('score_3', None),
                score_stats.get('score_2', None),
                score_stats.get('score_1', None)
            ))
            
            self.conn.commit()
            self.logger.info(f"Scraped statistics for anime {mal_id}")
            
        except Exception as e:
            self.logger.error(f"Error scraping statistics for anime {mal_id}: {e}")
    
    def extract_mal_id_from_url(self, url, entity_type='anime'):
        """Extract MAL ID from URL for different entity types"""
        pattern = f'/{entity_type}/(\\d+)'
        match = re.search(pattern, url)
        return int(match.group(1)) if match else None
    def scrape_anime_pictures(self, mal_id):
        """Scrape pictures for an anime"""
        pics_url = f'https://myanimelist.net/anime/{mal_id}/pics'
        response = self.safe_request(pics_url)
        if not response:
            return
        
        try:
            soup = BeautifulSoup(response.text, 'html.parser')
            pic_containers = soup.find_all('div', class_='picSurround')
            
            for i, container in enumerate(pic_containers[:Config.MAX_PICTURES_PER_ANIME]):
                try:
                    img_elem = container.find('img')
                    if img_elem:
                        image_url = img_elem.get('data-src') or img_elem.get('src', '')
                        if image_url:
                            # Insert picture data
                            self.conn.execute('''
                                INSERT OR REPLACE INTO pictures
                                (anime_mal_id, image_url, image_type)
                                VALUES (?, ?, ?)
                            ''', (mal_id, image_url, 'promotional'))
                            
                except Exception as e:
                    self.logger.error(f"Error scraping picture {i}: {e}")
                    continue
            
            self.conn.commit()
            self.logger.info(f"Scraped pictures for anime {mal_id}")
            
        except Exception as e:
            self.logger.error(f"Error scraping pictures for anime {mal_id}: {e}")
    
    def scrape_anime_news(self, mal_id):
        """Scrape news for an anime"""
        news_url = f'https://myanimelist.net/anime/{mal_id}/news'
        response = self.safe_request(news_url)
        if not response:
            return
        
        try:
            soup = BeautifulSoup(response.text, 'html.parser')
            news_containers = soup.find_all('div', class_='news-item')
            
            for container in news_containers[:10]:  # Limit to 10 news items
                try:
                    # News title and URL
                    title_elem = container.find('a', class_='news-title')
                    if not title_elem:
                        continue
                    
                    title = title_elem.text.strip()
                    url = title_elem.get('href', '')
                    
                    # News author and date
                    meta_elem = container.find('div', class_='news-meta')
                    author = 'N/A'
                    date = 'N/A'
                    if meta_elem:
                        author_elem = meta_elem.find('span', class_='author')
                        date_elem = meta_elem.find('span', class_='date')
                        if author_elem:
                            author = author_elem.text.strip()
                        if date_elem:
                            date = date_elem.text.strip()
                    
                    # News summary
                    summary_elem = container.find('div', class_='news-summary')
                    summary = summary_elem.get_text(strip=True) if summary_elem else 'N/A'
                    
                    # News image
                    img_elem = container.find('img')
                    image_url = img_elem.get('data-src') or img_elem.get('src', 'N/A') if img_elem else 'N/A'
                    
                    # Insert news data
                    self.conn.execute('''
                        INSERT OR REPLACE INTO news
                        (anime_mal_id, title, url, author, date, summary, image_url)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    ''', (mal_id, title, url, author, date, summary, image_url))
                    
                except Exception as e:
                    self.logger.error(f"Error scraping news item: {e}")
                    continue
            
            self.conn.commit()
            self.logger.info(f"Scraped news for anime {mal_id}")
            
        except Exception as e:
            self.logger.error(f"Error scraping news for anime {mal_id}: {e}")
    
    def scrape_anime_episodes(self, mal_id):
        """Scrape episode information for an anime"""
        episodes_url = f'https://myanimelist.net/anime/{mal_id}/episode'
        response = self.safe_request(episodes_url)
        if not response:
            return
        
        try:
            soup = BeautifulSoup(response.text, 'html.parser')
            episode_rows = soup.find_all('tr', class_='episode-list-data')
            
            for row in episode_rows:
                try:
                    cells = row.find_all('td')
                    if len(cells) < 4:
                        continue
                    
                    # Episode number
                    ep_num = self.extract_number_from_text(cells[0].text)
                    
                    # Episode title
                    title_elem = cells[1].find('a')
                    if title_elem:
                        title = title_elem.text.strip()
                        discussion_url = title_elem.get('href', '')
                    else:
                        title = cells[1].get_text(strip=True)
                        discussion_url = 'N/A'
                    
                    # Episode titles in Japanese/Romanji
                    title_japanese = 'N/A'
                    title_romanji = 'N/A'
                    if len(cells) > 2:
                        title_japanese = cells[2].get_text(strip=True)
                    if len(cells) > 3:
                        title_romanji = cells[3].get_text(strip=True)
                    
                    # Aired date
                    aired_date = 'N/A'
                    if len(cells) > 4:
                        aired_date = cells[4].get_text(strip=True)
                    
                    # Episode score and votes
                    score = None
                    votes = None
                    if len(cells) > 5:
                        score_text = cells[5].get_text(strip=True)
                        if score_text and score_text != 'N/A':
                            try:
                                score = float(score_text)
                            except ValueError:
                                pass
                    
                    if len(cells) > 6:
                        votes = self.extract_number_from_text(cells[6].text)
                    
                    # Insert episode data
                    self.conn.execute('''
                        INSERT OR REPLACE INTO episodes
                        (anime_mal_id, episode_number, title, title_japanese,
                         title_romanji, aired_date, score, votes, discussion_url)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (mal_id, ep_num, title, title_japanese, title_romanji,
                          aired_date, score, votes, discussion_url))
                    
                except Exception as e:
                    self.logger.error(f"Error scraping episode: {e}")
                    continue
            
            self.conn.commit()
            self.logger.info(f"Scraped episodes for anime {mal_id}")
            
        except Exception as e:
            self.logger.error(f"Error scraping episodes for anime {mal_id}: {e}")
    
    def get_character_details(self, char_mal_id):
        """Get detailed character information"""
        if not char_mal_id:
            return {}
        
        char_url = f'https://myanimelist.net/character/{char_mal_id}'
        response = self.safe_request(char_url)
        if not response:
            return {}
        
        try:
            soup = BeautifulSoup(response.text, 'html.parser')
            details = {}
            
            # Character name in kanji
            name_elem = soup.find('h1', class_='h1')
            if name_elem:
                kanji_elem = name_elem.find('span')
                if kanji_elem:
                    details['name_kanji'] = kanji_elem.text.strip()
            
            # About section
            about_elem = soup.find('div', id='content')
            if about_elem:
                about_text = about_elem.find('td', style=lambda s: s and 'vertical-align: top' in s)
                if about_text:
                    details['about'] = about_text.get_text(strip=True)
            
            # Favorites count
            fav_elem = soup.find('span', string=re.compile('Member Favorites:'))
            if fav_elem:
                fav_text = fav_elem.find_next_sibling()
                if fav_text:
                    details['member_favorites'] = self.extract_number_from_text(fav_text.text)
            
            return details
            
        except Exception as e:
            self.logger.error(f"Error getting character details for {char_mal_id}: {e}")
            return {}
    
    def get_staff_details(self, staff_mal_id):
        """Get detailed staff information"""
        if not staff_mal_id:
            return {}
        
        staff_url = f'https://myanimelist.net/people/{staff_mal_id}'
        response = self.safe_request(staff_url)
        if not response:
            return {}
        
        try:
            soup = BeautifulSoup(response.text, 'html.parser')
            details = {}
            
            # Name details
            info_section = soup.find('div', class_='people-informations')
            if info_section:
                for row in info_section.find_all('div', class_='spaceit_pad'):
                    text = row.get_text(strip=True)
                    if 'Given name:' in text:
                        details['given_name'] = text.split('Given name:', 1)[1].strip()
                    elif 'Family name:' in text:
                        details['family_name'] = text.split('Family name:', 1)[1].strip()
                    elif 'Alternate names:' in text:
                        details['alternate_names'] = text.split('Alternate names:', 1)[1].strip()
                    elif 'Birthday:' in text:
                        details['birthday'] = text.split('Birthday:', 1)[1].strip()
            
            # About section
            about_elem = soup.find('div', class_='people-biography')
            if about_elem:
                details['about'] = about_elem.get_text(strip=True)
            
            # Favorites count
            fav_elem = soup.find('span', string=re.compile('Member Favorites:'))
            if fav_elem:
                fav_text = fav_elem.find_next_sibling()
                if fav_text:
                    details['favorites'] = self.extract_number_from_text(fav_text.text)
            
            return details
            
        except Exception as e:
            self.logger.error(f"Error getting staff details for {staff_mal_id}: {e}")
            return {}
    
    def scrape_top_anime(self, limit=None):
        self.logger.info("Starting comprehensive top anime scraping...")
        idx = 0
        consecutive_failures = 0
        
        while consecutive_failures < 5:
            if limit and self.scraped_count >= limit:
                break
            
            url = f'https://myanimelist.net/topanime.php?type=tv&limit={idx}'
            response = self.safe_request(url)
            if not response:
                consecutive_failures += 1
                idx += 50
                continue
            
            soup = BeautifulSoup(response.text, 'html.parser')
            anime_links = soup.find_all('a', class_='hoverinfo_trigger fl-l ml12 mr8')
            
            if not anime_links:
                consecutive_failures += 1
                idx += 50
                continue
            
            consecutive_failures = 0
            
            for link in anime_links:
                if limit and self.scraped_count >= limit:
                    break
                
                anime_url = urljoin('https://myanimelist.net', link.get('href', ''))
                self.extract_comprehensive_anime_data(anime_url)
                self.smart_delay()
            
            idx += 50
    
    def scrape_seasonal_anime(self, years_back=15):
        self.logger.info(f"Starting comprehensive seasonal anime scraping...")
        current_year = datetime.now().year
        seasons = ['winter', 'spring', 'summer', 'fall']
        
        for year in range(current_year - years_back, current_year + 1):
            for season in seasons:
                url = f'https://myanimelist.net/anime/season/{year}/{season}'
                response = self.safe_request(url)
                if not response:
                    continue
                
                soup = BeautifulSoup(response.text, 'html.parser')
                anime_links = soup.find_all('a', class_='link-title')
                
                for link in anime_links:
                    anime_url = urljoin('https://myanimelist.net', link.get('href', ''))
                    if '/anime/' in anime_url:
                        self.extract_comprehensive_anime_data(anime_url)
                        self.smart_delay()
    
    def scrape_alphabetical_anime(self):
        self.logger.info("Starting comprehensive alphabetical anime scraping...")
        characters = list('ABCDEFGHIJKLMNOPQRSTUVWXYZ') + ['0-9']
        
        for char in characters:
            page = 0
            consecutive_empty = 0
            
            while consecutive_empty < 3:
                url = f'https://myanimelist.net/anime.php?letter={char}&show={page * 50}'
                response = self.safe_request(url)
                if not response:
                    consecutive_empty += 1
                    page += 1
                    continue
                
                soup = BeautifulSoup(response.text, 'html.parser')
                anime_links = soup.find_all('a', href=re.compile(r'/anime/\d+/'))
                
                if not anime_links:
                    consecutive_empty += 1
                    page += 1
                    continue
                
                consecutive_empty = 0
                found_new = False
                
                for link in anime_links:
                    anime_url = urljoin('https://myanimelist.net', link.get('href', ''))
                    if not self.is_already_scraped(anime_url):
                        if self.extract_comprehensive_anime_data(anime_url):
                            found_new = True
                        self.smart_delay()
                
                if not found_new:
                    consecutive_empty += 1
                
                page += 1
    
    def save_checkpoint(self):
        checkpoint_data = {
            'timestamp': datetime.now().isoformat(),
            'scraped_count': self.scraped_count,
            'elapsed_time': str(datetime.now() - self.start_time),
            'config': {
                'scrape_characters': Config.SCRAPE_CHARACTERS,
                'scrape_staff': Config.SCRAPE_STAFF,
                'scrape_reviews': Config.SCRAPE_REVIEWS,
                'scrape_recommendations': Config.SCRAPE_RECOMMENDATIONS,
                'scrape_statistics': Config.SCRAPE_STATISTICS,
                'scrape_pictures': Config.SCRAPE_PICTURES,
                'scrape_news': Config.SCRAPE_NEWS,
                'scrape_episodes': Config.SCRAPE_EPISODES
            }
        }
        
        checkpoint_file = Config.DATA_DIR / 'checkpoint.json'
        with open(checkpoint_file, 'w') as f:
            json.dump(checkpoint_data, f, indent=2)
        
        self.logger.info(f"Checkpoint saved: {self.scraped_count} anime scraped comprehensively")
    
    def export_all_data(self):
        self.logger.info("Exporting all comprehensive data to CSV files...")
        
        export_dir = Config.DATA_DIR / 'exports'
        export_dir.mkdir(exist_ok=True)
        
        # Export anime data
        anime_df = pd.read_sql_query('''
            SELECT 
                mal_id as "MAL_ID",
                title as "Title",
                title_english as "English_Title",
                title_japanese as "Japanese_Title",
                title_synonyms as "Synonyms",
                score as "Score",
                score_count as "Score_Count",
                popularity as "Popularity", 
                rank as "Rank",
                members as "Members",
                favorites as "Favorites",
                description as "Description",
                background as "Background",
                type as "Type",
                episodes as "Episodes",
                status as "Status",
                aired_from as "Aired_From",
                aired_to as "Aired_To",
                premiered as "Premiered",
                broadcast as "Broadcast",
                producers as "Producers", 
                licensors as "Licensors",
                studios as "Studios",
                source as "Source",
                genres as "Genres",
                themes as "Themes",
                demographics as "Demographics",
                duration as "Duration",
                rating as "Rating",
                trailer_url as "Trailer_URL",
                image_url as "Image_URL",
                opening_themes as "Opening_Themes",
                ending_themes as "Ending_Themes",
                related_anime as "Related_Anime",
                external_links as "External_Links"
            FROM anime_data 
            ORDER BY scraped_at
        ''', self.conn)
        
        anime_csv = export_dir / 'mal_anime_comprehensive.csv'
        anime_df.to_csv(anime_csv, index=False, encoding='utf-8')
        
        # Export characters data
        chars_df = pd.read_sql_query('''
            SELECT 
                c.mal_id as "Character_MAL_ID",
                a.title as "Anime_Title",
                c.name as "Character_Name",
                c.name_kanji as "Character_Name_Kanji",
                c.role as "Character_Role",
                c.description as "Character_Description",
                c.about as "Character_About",
                c.favorites as "Character_Favorites",
                c.member_favorites as "Member_Favorites",
                c.voice_actors as "Voice_Actors",
                c.image_url as "Character_Image_URL"
            FROM characters c
            JOIN anime_data a ON c.anime_mal_id = a.mal_id
            ORDER BY a.title, c.role
        ''', self.conn)
        
        chars_csv = export_dir / 'mal_characters.csv'
        chars_df.to_csv(chars_csv, index=False, encoding='utf-8')
        
        # Export staff data
        staff_df = pd.read_sql_query('''
            SELECT 
                s.mal_id as "Staff_MAL_ID",
                a.title as "Anime_Title",
                s.name as "Staff_Name",
                s.role as "Staff_Role",
                s.given_name as "Given_Name",
                s.family_name as "Family_Name",
                s.alternate_names as "Alternate_Names",
                s.birthday as "Birthday",
                s.about as "About",
                s.favorites as "Favorites",
                s.image_url as "Staff_Image_URL"
            FROM staff s
            JOIN anime_data a ON s.anime_mal_id = a.mal_id
            ORDER BY a.title, s.role
        ''', self.conn)
        
        staff_csv = export_dir / 'mal_staff.csv'
        staff_df.to_csv(staff_csv, index=False, encoding='utf-8')
        
        # Export reviews data
        reviews_df = pd.read_sql_query('''
            SELECT 
                a.title as "Anime_Title",
                r.reviewer_name as "Reviewer_Name",
                r.review_date as "Review_Date",
                r.episodes_watched as "Episodes_Watched",
                r.overall_score as "Overall_Score",
                r.story_score as "Story_Score",
                r.animation_score as "Animation_Score",
                r.sound_score as "Sound_Score",
                r.character_score as "Character_Score",
                r.enjoyment_score as "Enjoyment_Score",
                r.review_text as "Review_Text",
                r.helpful_count as "Helpful_Count"
            FROM reviews r
            JOIN anime_data a ON r.anime_mal_id = a.mal_id
            ORDER BY a.title, r.review_date
        ''', self.conn)
        
        reviews_csv = export_dir / 'mal_reviews.csv'
        reviews_df.to_csv(reviews_csv, index=False, encoding='utf-8')
        
        # Export recommendations data
        recs_df = pd.read_sql_query('''
            SELECT 
                a.title as "Anime_Title",
                r.recommended_title as "Recommended_Title",
                r.recommended_anime_id as "Recommended_MAL_ID",
                r.recommendation_count as "Recommendation_Count",
                r.description as "Recommendation_Description"
            FROM recommendations r
            JOIN anime_data a ON r.anime_mal_id = a.mal_id
            ORDER BY a.title, r.recommendation_count DESC
        ''', self.conn)
        
        recs_csv = export_dir / 'mal_recommendations.csv'
        recs_df.to_csv(recs_csv, index=False, encoding='utf-8')
        
        # Export statistics data
        stats_df = pd.read_sql_query('''
            SELECT 
                a.title as "Anime_Title",
                s.watching as "Watching",
                s.completed as "Completed",
                s.on_hold as "On_Hold",
                s.dropped as "Dropped",
                s.plan_to_watch as "Plan_to_Watch",
                s.score_10 as "Score_10",
                s.score_9 as "Score_9",
                s.score_8 as "Score_8",
                s.score_7 as "Score_7",
                s.score_6 as "Score_6",
                s.score_5 as "Score_5",
                s.score_4 as "Score_4",
                s.score_3 as "Score_3",
                s.score_2 as "Score_2",
                s.score_1 as "Score_1"
            FROM statistics s
            JOIN anime_data a ON s.anime_mal_id = a.mal_id
            ORDER BY a.title
        ''', self.conn)
        
        stats_csv = export_dir / 'mal_statistics.csv'
        stats_df.to_csv(stats_csv, index=False, encoding='utf-8')
        
        # Export episodes data
        episodes_df = pd.read_sql_query('''
            SELECT 
                a.title as "Anime_Title",
                e.episode_number as "Episode_Number",
                e.title as "Episode_Title",
                e.title_japanese as "Episode_Title_Japanese",
                e.title_romanji as "Episode_Title_Romanji",
                e.aired_date as "Aired_Date",
                e.score as "Episode_Score",
                e.votes as "Episode_Votes",
                e.discussion_url as "Discussion_URL"
            FROM episodes e
            JOIN anime_data a ON e.anime_mal_id = a.mal_id
            ORDER BY a.title, e.episode_number
        ''', self.conn)
        
        episodes_csv = export_dir / 'mal_episodes.csv'
        episodes_df.to_csv(episodes_csv, index=False, encoding='utf-8')
        
        # Export pictures data
        pictures_df = pd.read_sql_query('''
            SELECT 
                a.title as "Anime_Title",
                p.image_url as "Image_URL",
                p.image_type as "Image_Type",
                p.local_path as "Local_Path"
            FROM pictures p
            JOIN anime_data a ON p.anime_mal_id = a.mal_id
            ORDER BY a.title
        ''', self.conn)
        
        pictures_csv = export_dir / 'mal_pictures.csv'
        pictures_df.to_csv(pictures_csv, index=False, encoding='utf-8')
        
        # Export news data
        news_df = pd.read_sql_query('''
            SELECT 
                a.title as "Anime_Title",
                n.title as "News_Title",
                n.url as "News_URL",
                n.author as "News_Author",
                n.date as "News_Date",
                n.summary as "News_Summary",
                n.image_url as "News_Image_URL"
            FROM news n
            JOIN anime_data a ON n.anime_mal_id = a.mal_id
            ORDER BY a.title, n.date
        ''', self.conn)
        
        news_csv = export_dir / 'mal_news.csv'
        news_df.to_csv(news_csv, index=False, encoding='utf-8')
        
        # Create summary report
        summary = {
            'export_date': datetime.now().isoformat(),
            'total_anime': len(anime_df),
            'total_characters': len(chars_df),
            'total_staff': len(staff_df),
            'total_reviews': len(reviews_df),
            'total_recommendations': len(recs_df),
            'total_statistics': len(stats_df),
            'total_episodes': len(episodes_df),
            'total_pictures': len(pictures_df),
            'total_news': len(news_df),
            'files_exported': [
                'mal_anime_comprehensive.csv',
                'mal_characters.csv',
                'mal_staff.csv',
                'mal_reviews.csv',
                'mal_recommendations.csv',
                'mal_statistics.csv',
                'mal_episodes.csv',
                'mal_pictures.csv',
                'mal_news.csv'
            ]
        }
        
        summary_file = export_dir / 'export_summary.json'
        with open(summary_file, 'w') as f:
            json.dump(summary, f, indent=2)
        
        self.logger.info(f"Comprehensive data exported to {export_dir}")
        print(f"\n{'='*70}")
        print(f"🎉 COMPREHENSIVE MAL SCRAPING COMPLETE! 🎉")
        print(f"{'='*70}")
        print(f"📊 STATISTICS:")
        print(f"  Total Anime: {len(anime_df):,}")
        print(f"  Total Characters: {len(chars_df):,}")
        print(f"  Total Staff: {len(staff_df):,}")
        print(f"  Total Reviews: {len(reviews_df):,}")
        print(f"  Total Recommendations: {len(recs_df):,}")
        print(f"  Total Statistics: {len(stats_df):,}")
        print(f"  Total Episodes: {len(episodes_df):,}")
        print(f"  Total Pictures: {len(pictures_df):,}")
        print(f"  Total News: {len(news_df):,}")
        print(f"")
        print(f"📁 FILES EXPORTED:")
        for file in summary['files_exported']:
            print(f"  ✅ {file}")
        print(f"")
        print(f"⏱️  Runtime: {datetime.now() - self.start_time}")
        print(f"📂 Location: {export_dir}")
        print(f"{'='*70}")
        
        return summary
    
    def run_comprehensive_scrape(self):
        try:
            self.logger.info("Starting comprehensive MAL scraping with ALL data types...")
            self.scrape_top_anime(limit=5000)  # Top 5000 anime
            self.scrape_seasonal_anime(years_back=25)  # 25 years of seasonal anime
            self.scrape_alphabetical_anime()  # All alphabetical anime
        except Exception as e:
            self.logger.error(f"Error during comprehensive scraping: {e}")
        finally:
            self.save_checkpoint()
            return self.export_all_data()

def main():
    scraper = ComprehensiveMALScraper()
    try:
        summary = scraper.run_comprehensive_scrape()
        return summary
    except KeyboardInterrupt:
        print("\nComprehensive scraping interrupted")
        scraper.save_checkpoint()
        scraper.export_all_data()

if __name__ == "__main__":
    main()
SCRAPER_EOF

# Create startup script
log "Creating startup script..."
sudo -u scraper tee /home/scraper/mal_project/start_scraper.sh > /dev/null << 'START_EOF'
#!/bin/bash
cd /home/scraper/mal_project
source venv/bin/activate
nohup python mal_scraper.py > /home/scraper/scraper_output.log 2>&1 &
echo "MAL Scraper started! Monitor with: tail -f /home/scraper/mal_scraper.log"
echo "Or check output with: tail -f /home/scraper/scraper_output.log"
echo "Check progress: sqlite3 /home/scraper/mal_data.db 'SELECT COUNT(*) FROM anime_data;'"
START_EOF

sudo chmod +x /home/scraper/mal_project/start_scraper.sh

# Create monitoring script
log "Creating monitoring script..."
sudo -u scraper tee /home/scraper/mal_project/monitor.py > /dev/null << 'MONITOR_EOF'
#!/usr/bin/env python3
import sqlite3
import time
from datetime import datetime

def show_progress():
    try:
        conn = sqlite3.connect('/home/scraper/mal_data.db')
        
        # Total count
        cursor = conn.execute('SELECT COUNT(*) FROM anime_data')
        total = cursor.fetchone()[0]
        
        # Recent activity
        cursor = conn.execute('''
            SELECT COUNT(*) FROM anime_data 
            WHERE scraped_at > datetime('now', '-1 hour')
        ''')
        recent_hour = cursor.fetchone()[0]
        
        # Last scraped
        cursor = conn.execute('SELECT title, scraped_at FROM anime_data ORDER BY scraped_at DESC LIMIT 1')
        result = cursor.fetchone()
        last_title = result[0] if result else "None"
        last_time = result[1] if result else "Never"
        
        conn.close()
        
        print(f"\n{'='*60}")
        print(f"MAL SCRAPER PROGRESS - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"{'='*60}")
        print(f"Total Scraped: {total:,} anime")
        print(f"Last Hour: {recent_hour} anime")
        print(f"Rate: {recent_hour}/hour")
        print(f"Last Scraped: {last_title}")
        print(f"Last Update: {last_time}")
        
        if total > 0:
            # Estimate remaining (assuming 26,000 total)
            remaining = max(0, 26000 - total)
            if recent_hour > 0:
                hours_left = remaining / recent_hour
                print(f"Estimated Remaining: {remaining:,} anime ({hours_left:.1f} hours)")
            else:
                print(f"Estimated Remaining: {remaining:,} anime")
        
        print(f"{'='*60}")
        
    except Exception as e:
        print(f"Error checking progress: {e}")

if __name__ == "__main__":
    show_progress()
MONITOR_EOF

sudo chmod +x /home/scraper/mal_project/monitor.py

# Add swap space for low memory VMs
log "Setting up swap space (for low memory VMs)..."
if [ ! -f /swapfile ]; then
    sudo fallocate -l 2G /swapfile 2>/dev/null || sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    log "2GB swap space created"
fi

# Create systemd service for auto-restart
log "Creating systemd service..."
sudo tee /etc/systemd/system/mal-scraper.service > /dev/null << 'SERVICE_EOF'
[Unit]
Description=MAL Anime Scraper
After=network.target

[Service]
Type=forking
User=scraper
WorkingDirectory=/home/scraper/mal_project
ExecStart=/home/scraper/mal_project/start_scraper.sh
Restart=always
RestartSec=30

[Install]
WantedBy=multi-user.target
SERVICE_EOF

sudo systemctl daemon-reload
sudo systemctl enable mal-scraper

# Create convenient wrapper scripts for your user
log "Creating convenience commands for user descentkatil..."

# Create mal-start command for your user
tee ~/mal-start > /dev/null << 'MALSTART_EOF'
#!/bin/bash
echo "🚀 Starting Comprehensive MAL Scraper..."
echo "📊 This scraper will collect:"
echo "   • Anime details (titles, scores, descriptions, etc.)"
echo "   • Characters (names, descriptions, voice actors)"
echo "   • Staff (directors, producers, writers)"
echo "   • Reviews (user ratings and detailed reviews)"
echo "   • Recommendations (related anime suggestions)"
echo "   • Statistics (score distributions, status counts)"
echo "   • Pictures (promotional images)"
echo "   • News (related news articles)"
echo "   • Episodes (episode details and discussions)"
echo ""
sudo -u scraper /home/scraper/mal_project/start_scraper.sh
echo "✅ Comprehensive MAL Scraper started!"
echo ""
echo "Monitor progress with:"
echo "  mal-status    # Check detailed progress and statistics"
echo "  mal-log       # View live log"
echo "  mal-stats     # Quick status check"
echo "  mal-count     # Get current anime count"
MALSTART_EOF

# Create mal-stop command for your user
tee ~/mal-stop > /dev/null << 'MALSTOP_EOF'
#!/bin/bash
echo "🛑 Stopping Comprehensive MAL Scraper..."
sudo pkill -f mal_scraper.py
echo "✅ Comprehensive MAL Scraper stopped!"
echo "📊 Data has been automatically exported to multiple CSV files"
MALSTOP_EOF

# Create mal-status command for your user
tee ~/mal-status > /dev/null << 'MALSTATUS_EOF'
#!/bin/bash
sudo -u scraper python3 /home/scraper/mal_project/monitor.py
MALSTATUS_EOF

# Create mal-log command for your user
tee ~/mal-log > /dev/null << 'MALLOG_EOF'
#!/bin/bash
echo "📄 Watching MAL Scraper log (Ctrl+C to exit)..."
sudo tail -f /home/scraper/mal_scraper.log
MALLOG_EOF

# Create mal-export command for your user
tee ~/mal-export > /dev/null << 'MALEXPORT_EOF'
#!/bin/bash
echo "📊 Exporting comprehensive MAL data to CSV files..."
sudo -u scraper bash -c 'cd /home/scraper/mal_project && source venv/bin/activate && python -c "
from mal_scraper import ComprehensiveMALScraper
scraper = ComprehensiveMALScraper()
scraper.export_all_data()
"'
echo "✅ Comprehensive export complete!"
echo "📁 Files location: /home/scraper/mal_data/exports/"
echo ""
echo "📋 Exported files:"
echo "   • mal_anime_comprehensive.csv - Complete anime data"
echo "   • mal_characters.csv - Character information"
echo "   • mal_staff.csv - Staff and crew details"
echo "   • mal_reviews.csv - User reviews and ratings"
echo "   • mal_recommendations.csv - Anime recommendations"
echo "   • mal_statistics.csv - Score distributions and stats"
echo "   • mal_episodes.csv - Episode details"
echo "   • mal_pictures.csv - Image URLs"
echo "   • mal_news.csv - Related news articles"
echo ""
echo "To copy all files to your home directory:"
echo "  sudo cp -r /home/scraper/mal_data/exports ~/mal_data_exports"
MALEXPORT_EOF

# Make all scripts executable
chmod +x ~/mal-*

# Create quick stats script (accessible to all users)
log "Creating system-wide stats command..."
sudo tee /usr/local/bin/mal-stats > /dev/null << 'STATS_EOF'
#!/bin/bash
echo "🔍 MAL Scraper Status"
echo "===================="

# Check if scraper is running
if pgrep -f "mal_scraper.py" > /dev/null; then
    echo "✅ Scraper Status: RUNNING"
    echo "📊 Process ID: $(pgrep -f mal_scraper.py)"
else
    echo "❌ Scraper Status: STOPPED"
fi

# Show database stats
if [ -f /home/scraper/mal_data.db ]; then
    anime_count=$(sqlite3 /home/scraper/mal_data.db "SELECT COUNT(*) FROM anime_data;" 2>/dev/null || echo "0")
    char_count=$(sqlite3 /home/scraper/mal_data.db "SELECT COUNT(*) FROM characters;" 2>/dev/null || echo "0")
    staff_count=$(sqlite3 /home/scraper/mal_data.db "SELECT COUNT(*) FROM staff;" 2>/dev/null || echo "0")
    review_count=$(sqlite3 /home/scraper/mal_data.db "SELECT COUNT(*) FROM reviews;" 2>/dev/null || echo "0")
    
    echo "📈 Database Statistics:"
    echo "   • Anime: $anime_count"
    echo "   • Characters: $char_count"
    echo "   • Staff: $staff_count"
    echo "   • Reviews: $review_count"
    
    # Show recent activity
    recent=$(sqlite3 /home/scraper/mal_data.db "SELECT COUNT(*) FROM anime_data WHERE scraped_at > datetime('now', '-1 hour');" 2>/dev/null || echo "0")
    echo "⏱️  Last Hour: $recent anime"
    
    # Show last scraped
    last_anime=$(sqlite3 /home/scraper/mal_data.db "SELECT title FROM anime_data ORDER BY scraped_at DESC LIMIT 1;" 2>/dev/null || echo "None")
    echo "🎯 Last Scraped: $last_anime"
else
    echo "❓ Database not found"
fi

# Show log file size
if [ -f /home/scraper/mal_scraper.log ]; then
    log_size=$(du -h /home/scraper/mal_scraper.log | cut -f1)
    echo "📄 Log Size: $log_size"
fi

# Show disk usage
echo "💾 Disk Usage: $(df -h /home/scraper | tail -1 | awk '{print $3"/"$2" ("$5")"}')"

echo "===================="
echo "Commands for user descentkatil:"
echo "  ./mal-start      - Start scraping"
echo "  ./mal-stop       - Stop scraping" 
echo "  ./mal-status     - Detailed progress"
echo "  ./mal-log        - View live log"
echo "  ./mal-export     - Export data to CSV"
echo "  mal-stats        - This status check"
STATS_EOF

sudo chmod +x /usr/local/bin/mal-stats

# Add convenient aliases to your bashrc
log "Adding convenience aliases to your .bashrc..."
cat >> ~/.bashrc << 'BASHRC_EOF'

# Comprehensive MAL Scraper aliases
alias mal-start='~/mal-start'
alias mal-stop='~/mal-stop'
alias mal-status='~/mal-status'
alias mal-log='~/mal-log'
alias mal-export='~/mal-export'
alias mal-count="sqlite3 /home/scraper/mal_data.db 'SELECT COUNT(*) FROM anime_data;' 2>/dev/null || echo 'Database not found'"
alias mal-chars="sqlite3 /home/scraper/mal_data.db 'SELECT COUNT(*) FROM characters;' 2>/dev/null || echo 'Characters table not found'"
alias mal-staff="sqlite3 /home/scraper/mal_data.db 'SELECT COUNT(*) FROM staff;' 2>/dev/null || echo 'Staff table not found'"
alias mal-reviews="sqlite3 /home/scraper/mal_data.db 'SELECT COUNT(*) FROM reviews;' 2>/dev/null || echo 'Reviews table not found'"

# Quick access to comprehensive data
alias mal-data='cd /home/scraper/mal_data && ls -la'
alias mal-exports='cd /home/scraper/mal_data/exports && ls -la'
alias mal-copy-all='sudo cp -r /home/scraper/mal_data/exports ~/mal_comprehensive_data && echo "All CSV files copied to ~/mal_comprehensive_data/"'
BASHRC_EOF

# Set proper permissions
sudo chown -R scraper:scraper /home/scraper
sudo chmod +x /home/scraper/mal_project/*.sh

# Test the setup by running a quick check
log "Testing setup..."
if sudo -u scraper python3 -c "import requests, bs4, pandas; print('✅ All dependencies installed')"; then
    log "Dependency test passed"
else
    error "Dependency test failed"
fi

# Final setup summary
echo -e "\n${GREEN}🎉 Comprehensive MAL Scraper deployment completed successfully!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}📋 COMMANDS FOR USER descentkatil:${NC}"
echo ""
echo -e "  ${GREEN}./mal-start${NC}        # Start comprehensive scraping"
echo -e "  ${GREEN}./mal-status${NC}       # Check detailed progress with all data types"  
echo -e "  ${GREEN}./mal-log${NC}          # Watch live log"
echo -e "  ${GREEN}./mal-stop${NC}         # Stop scraping"
echo -e "  ${GREEN}./mal-export${NC}       # Export all data to multiple CSV files"
echo -e "  ${GREEN}mal-stats${NC}          # Quick status check"
echo -e "  ${GREEN}mal-count${NC}          # Get current anime count"
echo -e "  ${GREEN}mal-chars${NC}          # Get character count"
echo -e "  ${GREEN}mal-staff${NC}          # Get staff count"
echo -e "  ${GREEN}mal-reviews${NC}        # Get review count"
echo ""
echo -e "${YELLOW}📁 IMPORTANT FILES:${NC}"
echo -e "  Database: ${GREEN}/home/scraper/mal_data.db${NC} (SQLite with 9 tables)"
echo -e "  Main Export: ${GREEN}/home/scraper/mal_data/exports/mal_anime_comprehensive.csv${NC}"
echo -e "  All Exports: ${GREEN}/home/scraper/mal_data/exports/${NC}"
echo -e "  Logs: ${GREEN}/home/scraper/mal_scraper.log${NC}"
echo ""
echo -e "${YELLOW}💾 COMPREHENSIVE DATA ACCESS:${NC}"
echo -e "  ${GREEN}mal-copy-all${NC}       # Copy all CSV files to your home directory"
echo -e "  ${GREEN}mal-exports${NC}        # Browse exports directory"
echo -e "  ${GREEN}mal-data${NC}           # Browse main data directory"
echo ""
echo -e "${YELLOW}📊 DATA TYPES COLLECTED:${NC}"
echo -e "  ✅ Anime Details (titles, scores, descriptions, etc.)"
echo -e "  ✅ Characters (names, descriptions, voice actors)"
echo -e "  ✅ Staff (directors, producers, writers)"
echo -e "  ✅ Reviews (user ratings and detailed reviews)"
echo -e "  ✅ Recommendations (related anime suggestions)"
echo -e "  ✅ Statistics (score distributions, status counts)"
echo -e "  ✅ Pictures (promotional images and URLs)"
echo -e "  ✅ News (related news articles)"
echo -e "  ✅ Episodes (episode details and discussions)"
echo ""
echo -e "${YELLOW}💰 COST ESTIMATION:${NC}"

# Get machine type
machine_type=$(curl -s -H "Metadata-Flavor: Google" http://metadata.google.internal/computeMetadata/v1/instance/machine-type | cut -d'/' -f4 2>/dev/null || echo "unknown")
echo -e "  Machine Type: ${GREEN}$machine_type${NC}"

case $machine_type in
    *micro*) echo -e "  Estimated Cost: ${GREEN}~\$1.50${NC} for comprehensive 7-day scraping" ;;
    *small*) echo -e "  Estimated Cost: ${GREEN}~\$6.00${NC} for comprehensive 7-day scraping" ;;
    *medium*) echo -e "  Estimated Cost: ${GREEN}~\$12.00${NC} for comprehensive 7-day scraping" ;;
    *) echo -e "  Estimated Cost: ${GREEN}Check GCP pricing${NC} (comprehensive scraping takes longer)" ;;
esac

echo ""
echo -e "${YELLOW}🚀 TO START COMPREHENSIVE SCRAPING NOW:${NC}"
echo -e "  ${GREEN}./mal-start${NC}"
echo ""
echo -e "${YELLOW}📊 TO MONITOR PROGRESS:${NC}"
echo -e "  ${GREEN}watch -n 30 mal-stats${NC}     # Auto-refresh every 30 seconds"
echo -e "  ${GREEN}./mal-status${NC}              # Detailed one-time check"
echo ""
echo -e "${YELLOW}🔄 AUTO-START ON BOOT:${NC}"
echo -e "  Service enabled: ${GREEN}mal-scraper.service${NC}"
echo -e "  Manual control: ${GREEN}sudo systemctl start/stop mal-scraper${NC}"
echo ""
echo -e "${YELLOW}⚡ QUICK SETUP TEST:${NC}"
echo -e "  Run ${GREEN}./mal-start${NC} now to begin comprehensive scraping!"
echo -e "  Then run ${GREEN}mal-stats${NC} to see it working"
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🎌 Everything is ready! Comprehensive MAL scraping with: ./mal-start${NC}"
echo ""
echo -e "${YELLOW}💡 Pro Tips:${NC}"
echo -e "  • Use ${GREEN}screen${NC} or ${GREEN}tmux${NC} to run scraper in background"
echo -e "  • Check ${GREEN}mal-stats${NC} periodically to monitor all data types"
echo -e "  • The scraper will automatically resume if interrupted"
echo -e "  • All data is exported automatically to multiple CSV files"
echo -e "  • Comprehensive scraping takes longer but gets ALL available data"
echo ""
echo -e "${GREEN}🎯 Happy comprehensive scraping! You'll get EVERYTHING from MAL!${NC}"