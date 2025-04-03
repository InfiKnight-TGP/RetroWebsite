import streamlit as st
import streamlit.components.v1 as components

def main():
    st.set_page_config(
        page_title="R.E.T.R.O.",
        page_icon="🎮",
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
        }
        .feature-card {
            background-color: #262730;
            padding: 1.5em;
            border-radius: 10px;
            margin: 1em 0;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .coming-soon-card {
            background-color: #262730;
            padding: 1.5em;
            border-radius: 10px;
            margin: 1em 0;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            opacity: 0.8;
        }
        /* Remove blinking cursor from ALL text elements */
        * {
            caret-color: transparent;
        }
        /* Keep blinking cursor ONLY for input elements */
        input, textarea, select {
            caret-color: auto !important;
        }
        </style>
    """, unsafe_allow_html=True)

    # Title and Description
    st.markdown("""
        <h1 style='text-align: center; color: #FF4B4B;'>🎮 R.E.T.R.O.</h1>
        <h3 style='text-align: center; color: #FAFAFA;'>Recommendation Engine for Tailored Recreation & Online-content</h3>
    """, unsafe_allow_html=True)
    
    # Introduction
    st.markdown("""
        <div style='background-color: #262730; padding: 2em; border-radius: 10px; margin: 1em 0;'>
            <p style='color: #FAFAFA; font-size: 1.2em;'>
                Welcome to R.E.T.R.O., your personalized entertainment recommendation system! 
                We help you discover new content tailored to your preferences across multiple entertainment mediums.
            </p>
        </div>
    """, unsafe_allow_html=True)

    # Current Features
    st.markdown("<h2 style='color: #FF4B4B;'>🎯 Current Features</h2>", unsafe_allow_html=True)
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        st.markdown("""
            <div class='feature-card'>
                <h3 style='color: #FF4B4B;'>📺 Video Recommendations</h3>
                <ul style='color: #FAFAFA;'>
                    <li>YouTube video discovery</li>
                    <li>Category-based filtering</li>
                    <li>Trending videos section</li>
                    <li>Channel recommendations</li>
                    <li>View count information</li>
                    <li>Related content suggestions</li>
                </ul>
            </div>
        """, unsafe_allow_html=True)
    
    with col2:
        st.markdown("""
            <div class='feature-card'>
                <h3 style='color: #FF4B4B;'>🎵 Music Recommendations</h3>
                <ul style='color: #FAFAFA;'>
                    <li>YouTube Music integration</li>
                    <li>Genre-based music discovery</li>
                    <li>Language-specific searches</li>
                    <li>Music video suggestions</li>
                    <li>Personalized playlists</li>
                    <li>Trending music discovery</li>
                </ul>
            </div>
        """, unsafe_allow_html=True)
    
    with col3:
        st.markdown("""
            <div class='feature-card'>
                <h3 style='color: #FF4B4B;'>🎬 Movie Recommendations</h3>
                <ul style='color: #FAFAFA;'>
                    <li>Age-appropriate content filtering</li>
                    <li>Genre-based recommendations</li>
                    <li>Multiple language support</li>
                    <li>Detailed movie information</li>
                    <li>Family-friendly options</li>
                    <li>TMDB Integration</li>
                </ul>
            </div>
        """, unsafe_allow_html=True)

    # Coming Soon
    st.markdown("<h2 style='color: #FF4B4B;'>🚀 Coming Soon</h2>", unsafe_allow_html=True)
    
    coming_col1, coming_col2, coming_col3 = st.columns(3)
    
    with coming_col1:
        st.markdown("""
            <div class='coming-soon-card'>
                <h3 style='color: #FF4B4B;'>🎯 Anime Recommendations</h3>
                <ul style='color: #FAFAFA;'>
                    <li>Genre-based anime discovery</li>
                    <li>Seasonal anime tracking</li>
                    <li>Age-appropriate content filtering</li>
                    <li>Top-rated anime suggestions</li>
                    <li>Integration with MyAnimeList</li>
                </ul>
            </div>
        """, unsafe_allow_html=True)
    
    with coming_col2:
        st.markdown("""
            <div class='coming-soon-card'>
                <h3 style='color: #FF4B4B;'>🎮 Game Recommendations</h3>
                <ul style='color: #FAFAFA;'>
                    <li>Platform-specific suggestions</li>
                    <li>Genre-based recommendations</li>
                    <li>Age-appropriate filtering</li>
                    <li>Release date tracking</li>
                    <li>Popular games discovery</li>
                </ul>
            </div>
        """, unsafe_allow_html=True)
    
    with coming_col3:
        st.markdown("""
            <div class='coming-soon-card'>
                <h3 style='color: #FF4B4B;'>🤖 AI-Enhanced Features</h3>
                <ul style='color: #FAFAFA;'>
                    <li>Personalized recommendations</li>
                    <li>Smart content filtering</li>
                    <li>Advanced search capabilities</li>
                    <li>Cross-platform suggestions</li>
                    <li>User preference learning</li>
                </ul>
            </div>
        """, unsafe_allow_html=True)
    
    # Footer
    st.markdown("---")
    st.markdown("""
        <div style='background-color: #262730; padding: 2em; border-radius: 10px; margin: 1em 0;'>
            <h3 style='color: #FF4B4B;'>About R.E.T.R.O.</h3>
            <p style='color: #FAFAFA;'>
                R.E.T.R.O. is constantly evolving to provide you with the best entertainment recommendations. 
                Our goal is to help you discover content you'll love while saving time searching across multiple platforms.
            </p>
            <p style='color: #FAFAFA;'>Stay tuned for more exciting updates!</p>
        </div>
    """, unsafe_allow_html=True)

    st.markdown("""
        <div style='text-align: center; color: #FAFAFA; margin-top: 30px;'>
            Made with ❤️ using Streamlit
        </div>
    """, unsafe_allow_html=True)

if __name__ == "__main__":
    main() 