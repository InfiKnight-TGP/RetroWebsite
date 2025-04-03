import streamlit as st
from jikanpy import Jikan
from typing import Optional, Dict, List
import time

# Initialize Jikan client
jikan = Jikan()

def get_anime_recommendations(genres: List[str], rating: str = "g") -> List[Dict]:
    """Get anime recommendations based on genres and rating"""
    # Convert genres to Jikan genre IDs
    genre_ids = {
        "Action": 1,
        "Adventure": 2,
        "Comedy": 4,
        "Drama": 8,
        "Fantasy": 10,
        "Romance": 22,
        "Slice of Life": 36,
        "Sports": 30,
        "Mystery": 7,
        "Sci-Fi": 24
    }
    
    selected_genres = [str(genre_ids[g]) for g in genres if g in genre_ids]
    
    # Build search parameters for Jikan API
    parameters = {
        "genres": ",".join(selected_genres) if selected_genres else None,
        "rating": rating,
        "page": 1,
        "limit": 20,
        "sfw": True
    }
    
    try:
        # Search anime using Jikan API
        response = jikan.search('anime', query='', parameters=parameters)
        return response.get('data', [])
    except Exception as e:
        st.error(f"Error fetching anime: {str(e)}")
        return []

def get_seasonal_anime(season: str, year: int) -> List[Dict]:
    """Get seasonal anime recommendations"""
    try:
        # Get seasonal anime using Jikan API
        response = jikan.seasons(year=year, season=season)
        return response.get('data', [])
    except Exception as e:
        st.error(f"Error fetching seasonal anime: {str(e)}")
        return []

def get_anime_details(anime_id: int) -> Optional[Dict]:
    """Get detailed information about a specific anime"""
    try:
        # Get anime details using Jikan API
        response = jikan.anime(anime_id, extension='full')
        return response.get('data')
    except Exception as e:
        st.error(f"Error fetching anime details: {str(e)}")
        return None

def display_anime_card(anime: Dict):
    """Display anime information in a card format"""
    with st.container():
        col1, col2 = st.columns([1, 2])
        
        with col1:
            if anime.get('images', {}).get('jpg', {}).get('large_image_url'):
                st.image(anime['images']['jpg']['large_image_url'], use_column_width=True)
            else:
                st.write("No image available")
        
        with col2:
            st.header(anime.get('title', 'No title'))
            
            # Ratings section
            st.write("### Ratings")
            rating_col1, rating_col2, rating_col3 = st.columns(3)
            
            with rating_col1:
                if anime.get('score'):
                    st.write(f"**MAL Score:** ⭐ {anime['score']}/10")
                else:
                    st.write("**MAL Score:** N/A")
            
            with rating_col2:
                if anime.get('rating'):
                    rating_display = {
                        "g": "G - All Ages",
                        "pg": "PG - Children",
                        "pg13": "PG-13 - Teens 13 and Older",
                        "r17": "R - 17+ (violence & profanity)",
                        "r": "R+ - Profanity & Mild Nudity",
                        "rx": "Rx - Hentai"
                    }
                    st.write(f"**Content Rating:** {rating_display.get(anime['rating'], anime['rating'])}")
                else:
                    st.write("**Content Rating:** N/A")
            
            with rating_col3:
                if anime.get('rank'):
                    st.write(f"**Rank:** #{anime['rank']}")
                else:
                    st.write("**Rank:** N/A")
            
            # Details section
            st.write("### Details")
            if anime.get('genres'):
                genres = [g['name'] for g in anime['genres']]
                st.write(f"**Genres:** {', '.join(genres)}")
            
            if anime.get('status'):
                status_display = {
                    "Finished Airing": "Finished Airing",
                    "Currently Airing": "Currently Airing",
                    "Not yet aired": "Not Yet Aired"
                }
                st.write(f"**Status:** {status_display.get(anime['status'], anime['status'])}")
            
            if anime.get('type'):
                media_display = {
                    "TV": "TV Series",
                    "OVA": "OVA",
                    "Movie": "Movie",
                    "Special": "Special",
                    "ONA": "ONA",
                    "Music": "Music"
                }
                st.write(f"**Type:** {media_display.get(anime['type'], anime['type'])}")
            
            if anime.get('studios'):
                studios = [s['name'] for s in anime['studios']]
                st.write(f"**Studios:** {', '.join(studios)}")
            
            if anime.get('aired_from'):
                st.write(f"**Start Date:** {anime['aired_from']}")
            
            if anime.get('aired_to'):
                st.write(f"**End Date:** {anime['aired_to']}")
            
            if anime.get('episodes'):
                st.write(f"**Episodes:** {anime['episodes']}")
            
            if anime.get('duration'):
                st.write(f"**Episode Duration:** {anime['duration']}")
            
            if anime.get('source'):
                source_display = {
                    "Original": "Original",
                    "Manga": "Manga",
                    "Light novel": "Light Novel",
                    "Visual novel": "Visual Novel",
                    "Game": "Game",
                    "Card game": "Card Game",
                    "Book": "Book",
                    "Picture book": "Picture Book",
                    "Radio": "Radio",
                    "Music": "Music"
                }
                st.write(f"**Source:** {source_display.get(anime['source'], anime['source'])}")
            
            if anime.get('popularity'):
                st.write(f"**Popularity:** #{anime['popularity']}")
            
            if anime.get('members'):
                st.write(f"**Members:** {anime['members']}")
            
            if anime.get('favorites'):
                st.write(f"**Favorites:** {anime['favorites']}")
            
            # Synopsis
            if anime.get('synopsis'):
                st.write("### Synopsis")
                st.write(anime['synopsis'])

def get_suggested_anime() -> List[Dict]:
    """Get suggested anime for the user"""
    try:
        # Get top anime using Jikan API
        response = jikan.top(type='anime', page=1)
        return response.get('data', [])
    except Exception as e:
        st.error(f"Error fetching suggested anime: {str(e)}")
        return []

def main():
    st.set_page_config(layout="wide")
    st.title("Anime Recommendations")
    
    # Main content area
    st.write("### Find Your Next Favorite Anime!")
    
    # Create tabs for different recommendation types
    tab1, tab2, tab3 = st.tabs(["Genre Based", "Seasonal", "Suggested"])
    
    with tab1:
        st.write("#### Select Your Preferred Genres")
        # Genre selection with checkboxes
        col1, col2, col3 = st.columns(3)
        genres = {
            "Action": 1,
            "Adventure": 2,
            "Comedy": 4,
            "Drama": 8,
            "Fantasy": 10,
            "Romance": 22,
            "Slice of Life": 36,
            "Sports": 30,
            "Mystery": 7,
            "Sci-Fi": 24
        }
        
        selected_genres = []
        for i, (genre, _) in enumerate(genres.items()):
            if i < 4:
                with col1:
                    if st.checkbox(genre, key=f"genre_{i}"):
                        selected_genres.append(genre)
            elif i < 7:
                with col2:
                    if st.checkbox(genre, key=f"genre_{i}"):
                        selected_genres.append(genre)
            else:
                with col3:
                    if st.checkbox(genre, key=f"genre_{i}"):
                        selected_genres.append(genre)
        
        # Content rating selection with proper MAL ratings
        st.write("#### Select Content Rating")
        rating_options = {
            "G - All Ages": "g",
            "PG - Children": "pg",
            "PG-13 - Teens 13 or older": "pg13",
            "R - 17+ (violence & profanity)": "r17",
            "R+ - Mild Nudity": "r"
        }
        rating = st.selectbox(
            "Content Rating",
            options=list(rating_options.keys()),
            index=0
        )
        
        if st.button("Get Genre-Based Recommendations", type="primary"):
            with st.spinner("Fetching recommendations..."):
                recommendations = get_anime_recommendations(selected_genres, rating_options[rating])
                
                if recommendations:
                    st.write(f"Found {len(recommendations)} recommendations")
                    for anime in recommendations:
                        display_anime_card(anime)
                        st.divider()
                else:
                    st.warning("No recommendations found. Try selecting different genres.")
    
    with tab2:
        st.write("#### Select Season and Year")
        # Season and year selection
        col1, col2 = st.columns(2)
        
        with col1:
            current_year = time.localtime().tm_year
            season = st.selectbox(
                "Select Season",
                options=["winter", "spring", "summer", "fall"],
                index=0
            )
        
        with col2:
            year = st.number_input(
                "Select Year",
                min_value=2000,
                max_value=current_year,
                value=current_year
            )
        
        if st.button("Get Seasonal Anime", type="primary"):
            with st.spinner("Fetching seasonal anime..."):
                seasonal_anime = get_seasonal_anime(season, year)
                
                if seasonal_anime:
                    st.write(f"Found {len(seasonal_anime)} seasonal anime")
                    for anime in seasonal_anime:
                        display_anime_card(anime)
                        st.divider()
                else:
                    st.warning("No seasonal anime found for the selected season and year.")
    
    with tab3:
        st.write("#### Popular Anime")
        st.write("Get popular anime recommendations based on MyAnimeList rankings.")
        
        if st.button("Get Popular Anime", type="primary"):
            with st.spinner("Fetching popular anime..."):
                suggested_anime = get_suggested_anime()
                
                if suggested_anime:
                    st.write(f"Found {len(suggested_anime)} popular anime")
                    for anime in suggested_anime:
                        display_anime_card(anime)
                        st.divider()
                else:
                    st.warning("No popular anime found.")

if __name__ == "__main__":
    main() 