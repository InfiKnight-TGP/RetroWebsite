import streamlit as st
import requests
import random
from collections import defaultdict
from typing import Optional
import time

# Set page config
st.set_page_config(
    page_title="Movie Recommender",
    page_icon="🎬",
    layout="wide"
)

# API Keys
TMDB_API_KEY=st.secrets["tmdb_api_key"]
TMDB_ACCESS_TOKEN=st.secrets["tmdb_access_token"]

# TMDB Base URLs
TMDB_BASE_URL = "https://api.themoviedb.org/3"
TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500"

# TMDB Headers for API requests
TMDB_HEADERS = {
    "accept": "application/json",
    "Authorization": "Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJlNzQwMjVmOTA3MTAxODA1NmZlMmJiYzU1ZGViNWRjZCIsIm5iZiI6MTc0MDU4NzAyMS40NDk5OTk4LCJzdWIiOiI2N2JmNDAwZGMzZjhjNWE4MDRlZmM4ODYiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.Ispw3PDK9qCIQ79Z4xImfcoW2qT6lGcGBwXnxD1MVkQ"
}

# Language codes for TMDB API
LANGUAGE_CODES = {
    "English": "en",
    "Hindi": "hi",
    "Tamil": "ta",
    "Telugu": "te",
    "Kannada": "kn",
    "Malayalam": "ml"
}

# Genre IDs for TMDB API
GENRES = {
    "Action": 28,
    "Comedy": 35,
    "Drama": 18,
    "Family": 10751,
    "Horror": 27,
    "Romance": 10749,
    "Science Fiction": 878,
    "Animation": 16
}

# Initialize session state for recommendations
if 'movie_recommendations' not in st.session_state:
    st.session_state.movie_recommendations = []
if 'current_movie_index' not in st.session_state:
    st.session_state.current_movie_index = 0
if 'shown_movies' not in st.session_state:
    st.session_state.shown_movies = set()  # Store movie IDs we've already shown
if 'current_page' not in st.session_state:
    st.session_state.current_page = 1
if 'service_unavailable' not in st.session_state:
    st.session_state.service_unavailable = False

def check_service_availability():
    """Check if TMDB API service is available"""
    try:
        response = requests.get(f"{TMDB_BASE_URL}/configuration", headers=TMDB_HEADERS, timeout=5)
        return response.status_code == 200
    except:
        return False

def get_streaming_providers(tmdb_id):
    """Get streaming providers for a movie using TMDB API"""
    if st.session_state.service_unavailable:
        return []
        
    try:
        url = f"{TMDB_BASE_URL}/movie/{tmdb_id}/watch/providers"
        params = {"api_key": TMDB_API_KEY}
        response = requests.get(url, params=params, timeout=5)
        if response.status_code == 200:
            data = response.json()
            results = data.get("results", {}).get("US", {})
            return results.get("flatrate", []) + results.get("free", [])
    except:
        pass
    return []

def get_age_certification_params(age):
    """
    Get appropriate certification parameters based on age
    """
    if age <= 10:
        return {
            "certification_country": "US",
            "certification.lte": "G",
            "vote_average.lte": 10,
            "vote_average.gte": 0,
            "include_adult": False
        }
    elif age <= 13:
        return {
            "certification_country": "US",
            "certification.lte": "PG",
            "vote_average.lte": 10,
            "vote_average.gte": 0,
            "include_adult": False
        }
    elif age <= 16:
        return {
            "certification_country": "US",
            "certification.lte": "PG-13",
            "vote_average.lte": 10,
            "vote_average.gte": 0,
            "include_adult": False
        }
    else:
        return {
            "certification_country": "US",
            "certification.lte": "R",
            "vote_average.lte": 10,
            "vote_average.gte": 0,
            "include_adult": True
        }

def get_omdb_details(imdb_id):
    """Get movie details from OMDB API"""
    try:
        url = f"http://www.omdbapi.com/?i={imdb_id}&apikey={OMDB_API_KEY}&plot=full"
        response = requests.get(url)
        if response.status_code == 200:
            data = response.json()
            if data.get('Response') == 'True':
                return {
                    'imdb_rating': data.get('imdbRating', 'N/A'),
                    'imdb_votes': data.get('imdbVotes', 'N/A'),
                    'metascore': data.get('Metascore', 'N/A'),
                    'runtime': data.get('Runtime', 'N/A'),
                    'rated': data.get('Rated', 'N/A'),
                    'awards': data.get('Awards', 'N/A'),
                    'director': data.get('Director', 'N/A'),
                    'actors': data.get('Actors', 'N/A'),
                    'plot': data.get('Plot', 'N/A'),
                    'genre': data.get('Genre', 'N/A'),
                    'year': data.get('Year', 'N/A'),
                    'country': data.get('Country', 'N/A'),
                    'language': data.get('Language', 'N/A'),
                    'box_office': data.get('BoxOffice', 'N/A')
                }
    except Exception as e:
        st.error(f"Error fetching OMDB details: {str(e)}")
    return None

def get_movie_recommendations(genre, age_rating, language):
    """
    Get movie recommendations with advanced TMDB filtering
    """
    # Check service availability first
    if not check_service_availability():
        st.session_state.service_unavailable = True
        st.error("""
            🎬 Movie Recommender Service Temporarily Unavailable
            
            We're experiencing some technical difficulties with our movie recommendation service. 
            This is likely a temporary issue. Please try again in a few minutes.
            
            If the problem persists, you can:
            1. Try refreshing the page
            2. Check your internet connection
            3. Try again later
            
            We apologize for any inconvenience.
        """)
        return []

    try:
        language_code = LANGUAGE_CODES.get(language, 'en')
        cert_params = get_age_certification_params(age_rating)
        
        url = f"{TMDB_BASE_URL}/discover/movie"
        params = {
            "with_genres": genre,
            "with_original_language": language_code,
            "language": f"{language_code}-{language_code.upper()}",
            "sort_by": "popularity.desc",
            "page": st.session_state.current_page,
            "include_adult": False,
            "include_video": False
        }

        # Adjust filtering criteria based on language
        if language in ["English", "Hindi"]:
            params.update({
                "vote_count.gte": 100,
                "vote_average.gte": 5.0,
                "certification_country": "US",
                "certification.lte": cert_params.get('certification.lte', 'G')
            })
        else:
            params.update({
                "vote_count.gte": 20,
                "vote_average.gte": 3.0,
                "certification_country": "IN",
                "sort_by": "release_date.desc"
            })
        
        if age_rating <= 10:
            params["with_genres"] = "16"
            st.info("Showing animated movies suitable for kids!")
        
        response = requests.get(url, headers=TMDB_HEADERS, params=params, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            total_pages = data.get("total_pages", 1)
            
            if st.session_state.current_page > total_pages:
                st.session_state.current_page = 1
                st.info("You've reached the end of available movies. Starting over from the beginning!")
            
            movies = data.get("results", [])
            filtered_movies = []
            
            for movie in movies:
                if movie["id"] in st.session_state.shown_movies:
                    continue
                    
                if movie.get("original_language") != language_code:
                    continue
                    
                if movie.get("adult", False):
                    continue
                
                if age_rating <= 10:
                    if 16 not in movie.get("genre_ids", []):
                        continue
                
                try:
                    details_url = f"{TMDB_BASE_URL}/movie/{movie['id']}"
                    details_response = requests.get(details_url, headers=TMDB_HEADERS, timeout=5)
                    
                    if details_response.status_code == 200:
                        movie_details = details_response.json()
                        imdb_id = movie_details.get("imdb_id")
                        
                        alt_titles_url = f"{TMDB_BASE_URL}/movie/{movie['id']}/alternative_titles"
                        alt_titles_response = requests.get(alt_titles_url, headers=TMDB_HEADERS, timeout=5)
                        
                        if alt_titles_response.status_code == 200:
                            alt_titles = alt_titles_response.json()
                            movie['alternative_titles'] = alt_titles.get('titles', [])
                        
                        if imdb_id:
                            movie['omdb_details'] = get_omdb_details(imdb_id)
                        
                        movie['genre_names'] = []
                        for genre_id in movie.get('genre_ids', []):
                            genre_name = next((name for name, id in GENRES.items() if id == genre_id), None)
                            if genre_name:
                                movie['genre_names'].append(genre_name)
                        
                        filtered_movies.append(movie)
                        st.session_state.shown_movies.add(movie["id"])
                except:
                    continue
            
            return filtered_movies
        
        return []
        
    except Exception as e:
        if "Connection aborted" in str(e):
            st.session_state.service_unavailable = True
            st.error("""
                🎬 Movie Recommender Service Temporarily Unavailable
                
                We're experiencing some technical difficulties with our movie recommendation service. 
                This is likely a temporary issue. Please try again in a few minutes.
                
                If the problem persists, you can:
                1. Try refreshing the page
                2. Check your internet connection
                3. Try again later
                
                We apologize for any inconvenience.
            """)
        return []

def get_movie_details(tmdb_id):
    """Get detailed movie information using both APIs"""
    # Get TMDB details
    url = f"{TMDB_BASE_URL}/movie/{tmdb_id}"
    params = {"api_key": TMDB_API_KEY}
    response = requests.get(url, params=params)
    if response.status_code == 200:
        tmdb_data = response.json()
        
        # Get IMDB ID from TMDB
        imdb_id = tmdb_data.get("imdb_id")
        
        # Get OMDB details using IMDB ID
        omdb_url = f"http://www.omdbapi.com/?i={imdb_id}&apikey={OMDB_API_KEY}"
        omdb_response = requests.get(omdb_url)
        if omdb_response.status_code == 200:
            omdb_data = omdb_response.json()
            
            # Combine data from both APIs
            return {
                "title": tmdb_data.get("title"),
                "overview": tmdb_data.get("overview"),
                "poster": f"{TMDB_IMAGE_BASE_URL}{tmdb_data.get('poster_path')}",
                "rating": omdb_data.get("imdbRating"),
                "year": omdb_data.get("Year"),
                "runtime": omdb_data.get("Runtime"),
                "streaming_providers": get_streaming_providers(tmdb_id)
            }
    return None

def get_regional_movies(language, tmdb_id):
    """Get regional movie details including alternative titles"""
    url = f"{TMDB_BASE_URL}/movie/{tmdb_id}/alternative_titles"
    params = {
        "api_key": TMDB_API_KEY
    }
    
    try:
        response = requests.get(url, params=params)
        if response.status_code == 200:
            data = response.json()
            # Check if movie has title in selected language
            titles = data.get("titles", [])
            return any(title.get("iso_3166_1") == LANGUAGE_CODES[language] for title in titles)
    except:
        return False
    return False

def filter_recommendations(movies, language):
    """Filter movies to ensure they match the selected language"""
    filtered_movies = []
    for movie in movies:
        # Check original language
        if movie.get("original_language") == LANGUAGE_CODES[language]:
            filtered_movies.append(movie)
        # For non-English languages, do additional checks
        elif language != "English" and get_regional_movies(language, movie["id"]):
            filtered_movies.append(movie)
    return filtered_movies

def get_movie_rating(tmdb_id):
    """Get movie age rating from TMDB"""
    try:
        url = f"{TMDB_BASE_URL}/movie/{tmdb_id}/release_dates"
        response = requests.get(url, headers=TMDB_HEADERS)
        if response.status_code == 200:
            data = response.json()
            # Get US release dates
            us_releases = [r for r in data.get("results", []) 
                         if r.get("iso_3166_1") == "US"]
            if us_releases:
                # Get the first certification
                release_dates = us_releases[0].get("release_dates", [])
                if release_dates:
                    return release_dates[0].get("certification", "N/A")
    except Exception as e:
        st.error(f"Error fetching movie rating: {str(e)}")
    return "N/A"

def display_movie_card(movie, omdb_details):
    """Display movie information in a card format"""
    with st.container():
        col1, col2 = st.columns([1, 2])
        
        with col1:
            if movie.get('poster_path'):
                poster_url = f"https://image.tmdb.org/t/p/w500{movie['poster_path']}"
                st.image(poster_url, use_column_width=True)
            else:
                st.write("No poster available")
        
        with col2:
            # Display title in original language and English
            st.header(movie.get('title', 'No title'))
            if movie.get('original_title') and movie.get('original_title') != movie.get('title'):
                st.write(f"Original Title: {movie.get('original_title')}")
            
            # Get age rating and streaming providers
            age_rating = get_movie_rating(movie['id'])
            streaming_providers = get_streaming_providers(movie['id'])
            
            # Ratings section
            st.write("### Ratings")
            rating_col1, rating_col2, rating_col3 = st.columns(3)
            
            with rating_col1:
                if omdb_details and omdb_details.get('imdb_rating') != 'N/A':
                    st.write(f"**IMDb:** ⭐ {omdb_details['imdb_rating']}/10")
                    if omdb_details.get('imdb_votes') != 'N/A':
                        st.write(f"({omdb_details['imdb_votes']} votes)")
                else:
                    st.write(f"**TMDB:** ⭐ {movie.get('vote_average', 'N/A')}/10")
                    st.write(f"({movie.get('vote_count', 'N/A')} votes)")
            
            with rating_col2:
                st.write(f"**Age Rating:** {age_rating}")
                if omdb_details and omdb_details.get('rated') != 'N/A':
                    st.write(f"({omdb_details['rated']})")
            
            with rating_col3:
                if omdb_details and omdb_details.get('metascore') != 'N/A':
                    st.write(f"**Metascore:** {omdb_details['metascore']}/100")
                else:
                    st.write("**Metascore:** N/A")
            
            # Genres
            if movie.get('genre_names'):
                st.write("### Genres")
                st.write(", ".join(movie['genre_names']))
            
            # Streaming Providers
            if streaming_providers:
                st.write("### Where to Watch")
                provider_cols = st.columns(4)
                for idx, provider in enumerate(streaming_providers):
                    with provider_cols[idx % 4]:
                        if provider.get('logo_path'):
                            provider_logo = f"https://image.tmdb.org/t/p/original{provider['logo_path']}"
                            st.image(provider_logo, width=50)
                        st.write(provider.get('provider_name', 'Unknown'))
            
            # Movie details
            st.write("### Details")
            if omdb_details:
                if omdb_details.get('year') != 'N/A':
                    st.write(f"**Year:** {omdb_details['year']}")
                if omdb_details.get('runtime') != 'N/A':
                    st.write(f"**Runtime:** {omdb_details['runtime']}")
                if omdb_details.get('director') != 'N/A':
                    st.write(f"**Director:** {omdb_details['director']}")
                if omdb_details.get('actors') != 'N/A':
                    st.write(f"**Cast:** {omdb_details['actors']}")
                if omdb_details.get('country') != 'N/A':
                    st.write(f"**Country:** {omdb_details['country']}")
                if omdb_details.get('language') != 'N/A':
                    st.write(f"**Language:** {omdb_details['language']}")
                if omdb_details.get('box_office') != 'N/A':
                    st.write(f"**Box Office:** {omdb_details['box_office']}")
                if omdb_details.get('awards') != 'N/A':
                    st.write(f"**Awards:** {omdb_details['awards']}")
            
            # Alternative Titles
            if movie.get('alternative_titles'):
                st.write("### Alternative Titles")
                alt_titles_text = ""
                for title in movie['alternative_titles']:
                    if title.get('iso_3166_1') != 'IN':  # Skip Indian titles as they're usually duplicates
                        alt_titles_text += f"{title.get('title')} ({title.get('iso_3166_1')}), "
                if alt_titles_text:
                    st.write(alt_titles_text.rstrip(", "))
            
            # Plot
            st.write("### Plot")
            if omdb_details and omdb_details.get('plot') != 'N/A':
                st.write(omdb_details['plot'])
            else:
                st.write(movie.get('overview', 'No overview available'))

def main():
    # Custom CSS
    st.markdown("""
        <style>
        .main {
            background-color: #0E1117;
        }
        .stButton>button {
            width: 100%;
            border-radius: 5px;
            height: 3em;
            margin-top: 1em;
            background-color: #FF4B4B;
            color: white;
            border: none;
        }
        .stButton>button:hover {
            background-color: #FF6B6B;
        }
        .preference-card {
            background-color: #262730;
            padding: 1.5em;
            border-radius: 10px;
            margin: 1em 0;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .movie-container {
            background-color: #262730;
            padding: 1.5em;
            border-radius: 10px;
            margin: 1em 0;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        /* Remove blinking cursor from text elements */
        .stMarkdown, .stText, .stInfo, .stWarning, .stError, .stSuccess {
            caret-color: transparent;
        }
        /* Remove blinking cursor from select boxes */
        .stSelectbox select {
            caret-color: transparent;
        }
        /* Remove blinking cursor from sliders */
        .stSlider input {
            caret-color: transparent;
        }
        /* Remove blinking cursor from buttons */
        .stButton button {
            caret-color: transparent;
        }
        /* Remove blinking cursor from all text inputs */
        input[type="text"], input[type="number"], input[type="password"] {
            caret-color: transparent;
        }
        /* Remove blinking cursor from textareas */
        textarea {
            caret-color: transparent;
        }
        </style>
    """, unsafe_allow_html=True)

    # Title
    st.markdown("""
        <h1 style='text-align: center; color: #FF4B4B;'>🎬 Movie Recommender</h1>
    """, unsafe_allow_html=True)
    
    # Add a reset button at the top
    if st.sidebar.button("Reset All Recommendations"):
        st.session_state.shown_movies = set()
        st.session_state.current_page = 1
        st.session_state.service_unavailable = False
    
    # Create a container for preferences
    with st.container():
        st.markdown("""
            <div class='preference-card'>
                <h2 style='color: #FF4B4B;'>Your Preferences</h2>
            </div>
        """, unsafe_allow_html=True)
        
        # Create three columns for preferences
        col1, col2, col3 = st.columns(3)
        
        with col1:
            # Genre selection
            genre = st.selectbox(
                "Select Genre",
                [(name, id) for name, id in GENRES.items()],
                format_func=lambda x: x[0]
            )
        
        with col2:
            # Age rating selection
            age = st.slider(
                "Select your age",
                min_value=1,
                max_value=100,
                value=18,
                step=1
            )
        
        with col3:
            # Language selection
            language = st.selectbox(
                "Select Language",
                ["English", "Hindi", "Tamil", "Telugu", "Kannada", "Malayalam"]
            )
        
        # Center the recommendation button
        col1, col2, col3 = st.columns([1, 2, 1])
        with col2:
            if st.button("Get Movie Recommendations", use_container_width=True):
                # Clear previous recommendations when starting fresh
                st.session_state.shown_movies = set()
                st.session_state.current_page += 1  # Increment the page number
                st.session_state.movie_recommendations = []
                st.session_state.current_movie_index = 0
                movies = get_movie_recommendations(genre[1], age, language)
                
                if movies:
                    st.session_state.movie_recommendations = movies
                    st.session_state.current_movie_index = 0
                elif not st.session_state.service_unavailable:
                    st.warning(f"No new movies found for {language} language and {genre[0]} genre. Try different preferences.")
        
        # Display current movie
        if st.session_state.movie_recommendations:
            current_movie = st.session_state.movie_recommendations[st.session_state.current_movie_index]
            st.markdown("""
                <div class='movie-container'>
            """, unsafe_allow_html=True)
            display_movie_card(current_movie, current_movie.get('omdb_details'))
            st.markdown("</div>", unsafe_allow_html=True)
            
            # Move to next movie
            if st.session_state.current_movie_index < len(st.session_state.movie_recommendations) - 1:
                st.session_state.current_movie_index += 1
        else:
            st.info("👆 Click 'Get Movie Recommendations' above to start!")

if __name__ == "__main__":
    main() 
