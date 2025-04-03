import streamlit as st
import os
from dotenv import load_dotenv
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
import json
import random
from collections import defaultdict

# Load environment variables
load_dotenv()

# Language code mapping
LANGUAGE_CODES = {
    "Hindi": "hi",
    "Tamil": "ta",
    "Telugu": "te",
    "Kannada": "kn",
    "Malayalam": "ml"
}

# YouTube API setup
OMDB_API_KEY=st.secrets["omdb_api_key"]
youtube = build('youtube', 'v3', developerKey=YOUTUBE_API_KEY)

# Load music search queries and fallback videos from JSON
with open('music_queries.json', 'r', encoding='utf-8') as f:
    MUSIC_QUERIES = json.load(f)
with open('music_fallback_videos.json', 'r', encoding='utf-8') as f:
    FALLBACK_VIDEOS = json.load(f)

# Track iterations for each mood-age-language combination
if 'music_topic_iterations' not in st.session_state:
    st.session_state.music_topic_iterations = defaultdict(int)
if 'music_current_topic' not in st.session_state:
    st.session_state.music_current_topic = defaultdict(str)

def get_age_group(age):
    """
    Determine age group based on age
    """
    if age <= 12:
        return "kids"
    elif 13 <= age <= 19:
        return "teens"
    else:
        return "adults"

def get_fallback_video(mood, age_group):
    """
    Get a fallback video ID based on mood and age group
    """
    try:
        return FALLBACK_VIDEOS.get(mood, {}).get(age_group)
    except Exception:
        return None

def get_music_recommendation(mood, age_group, language):
    """
    Get a music video recommendation based on mood, age group, and language
    """
    try:
        # Get search queries for the selected mood, age group, and language
        queries = MUSIC_QUERIES.get(mood, {}).get(age_group, {}).get(language, [])
        
        if not queries:
            # If no queries found for the specific language, try English as fallback
            queries = MUSIC_QUERIES.get(mood, {}).get(age_group, {}).get("English", [])
            
            if not queries:
                # If still no queries found, use fallback video
                fallback_id = get_fallback_video(mood, age_group)
                if fallback_id:
                    return {'id': fallback_id}
                return None
        
        # Create a unique key for this mood-age-language combination
        combo_key = f"{mood}-{age_group}-{language}"
        
        # If no current topic OR we've shown all 5 videos OR 20% random chance
        if (not st.session_state.music_current_topic[combo_key] or 
            st.session_state.music_topic_iterations[combo_key] >= 5 or 
            random.random() < 0.2):
            
            # Pick new topic and reset iteration count
            st.session_state.music_current_topic[combo_key] = random.choice(queries)
            st.session_state.music_topic_iterations[combo_key] = 1
        else:
            # Increment iteration for current topic
            st.session_state.music_topic_iterations[combo_key] += 1
        
        # Use current topic as query
        query = st.session_state.music_current_topic[combo_key]
        
        # Calculate which video to show (0-4)
        result_index = st.session_state.music_topic_iterations[combo_key] - 1
        
        # Search for music videos with language-specific parameters
        search_response = youtube.search().list(
            q=query,
            part="snippet",
            maxResults=5,
            type="video",
            videoCategoryId="10",  # Music category
            videoDuration="medium",
            videoEmbeddable="true",
            videoSyndicated="true",
            relevanceLanguage=LANGUAGE_CODES.get(language) if language != "English" else None
        ).execute()
        
        # Process search results
        if search_response.get('items'):
            item = search_response['items'][result_index]
            return {'id': item['id']['videoId']}
        
        # If no results found, try without language filter
        if language != "English":
            search_response = youtube.search().list(
                q=query,
                part="snippet",
                maxResults=5,
                type="video",
                videoCategoryId="10",  # Music category
                videoDuration="medium",
                videoEmbeddable="true",
                videoSyndicated="true"
            ).execute()
            
            if search_response.get('items'):
                item = search_response['items'][result_index]
                return {'id': item['id']['videoId']}
        
        # If still no results found, use fallback video
        fallback_id = get_fallback_video(mood, age_group)
        if fallback_id:
            return {'id': fallback_id}
        
        return None
        
    except HttpError as e:
        st.warning("YouTube API request failed. Using fallback video.")
        # Use fallback video on API error
        fallback_id = get_fallback_video(mood, age_group)
        if fallback_id:
            return {'id': fallback_id}
        return None
    except Exception as e:
        st.error(f"An error occurred: {e}")
        # Use fallback video on general error
        fallback_id = get_fallback_video(mood, age_group)
        if fallback_id:
            return {'id': fallback_id}
        return None

def main():
    st.set_page_config(
        page_title="YouTube Music",
        page_icon="🎵",
        layout="wide"
    )

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
        .video-container {
            background-color: #262730;
            padding: 1.5em;
            border-radius: 10px;
            margin: 1em 0;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        /* Remove blinking cursor from all elements */
        * {
            caret-color: transparent !important;
        }
        /* Ensure text remains selectable */
        .stMarkdown, .stText, .stInfo, .stWarning, .stError, .stSuccess {
            user-select: text;
            -webkit-user-select: text;
            -moz-user-select: text;
            -ms-user-select: text;
        }
        /* Keep cursor visible for interactive elements */
        .stSelectbox select,
        .stSlider input,
        .stButton button,
        input[type="text"],
        input[type="number"],
        input[type="password"],
        textarea {
            caret-color: auto !important;
        }
        </style>
    """, unsafe_allow_html=True)

    # Title
    st.markdown("""
        <h1 style='text-align: center; color: #FF4B4B;'>🎵 YouTube Music</h1>
    """, unsafe_allow_html=True)
    
    # Add a reset button at the top
    if st.sidebar.button("Reset All Recommendations"):
        st.session_state.music_topic_iterations = defaultdict(int)
        st.session_state.music_current_topic = defaultdict(str)
        st.session_state.get_new_recommendation = False
    
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
            # Mood selection
            mood = st.selectbox(
                "How are you feeling today?",
                ["Happy", "Sad", "Energetic", "Relaxed", "Stressed", "Bored", "Adventurous"]
            )
        
        with col2:
            # Age selection with slider
            age = st.slider(
                "Select your age",
                min_value=1,
                max_value=100,
                value=18,
                step=1
            )
            
            # Display age group based on age
            age_group = get_age_group(age)
            st.info(f"Age Group: {age_group.title()}")
        
        with col3:
            # Language selection
            language = st.selectbox(
                "Select your preferred language",
                ["English", "Hindi", "Tamil", "Telugu", "Kannada", "Malayalam"]
            )
        
        # Center the recommendation button
        col1, col2, col3 = st.columns([1, 2, 1])
        with col2:
            if st.button("Get Music Recommendation", use_container_width=True):
                st.session_state.get_new_recommendation = True
    
    # Initialize session state for new recommendation
    if 'get_new_recommendation' not in st.session_state:
        st.session_state.get_new_recommendation = False
    
    # Get and display recommendation
    if st.session_state.get_new_recommendation:
        video = get_music_recommendation(mood, age_group, language)
        if video:
            # Center the video content
            col1, col2, col3 = st.columns([1, 2, 1])
            with col2:
                st.markdown("""
                    <div class='video-container'>
                        <h3 style='color: #FF4B4B; text-align: center;'>Recommended Music</h3>
                    </div>
                """, unsafe_allow_html=True)
                st.video(f"https://www.youtube.com/watch?v={video['id']}")
        else:
            st.warning("No music found. Please try different preferences.")
        
        # Reset the flag
        st.session_state.get_new_recommendation = False
    else:
        st.info("👆 Click 'Get Music Recommendation' above to start!")

if __name__ == "__main__":
    main() 
