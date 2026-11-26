import os
import unittest
from app.extractor import translate_extractor_error, get_cookies_path

class TestExtractorResilience(unittest.TestCase):
    def test_translate_instagram_empty_media_response(self):
        raw_error = Exception(
            "ERROR: [Instagram] Df1PXDvE35p: Instagram sent an empty media response. "
            "Check if this post is accessible in your browser without being logged-in. "
            "If it is not, then use --cookies-from-browser or --cookies for the authentication. "
            "See https://github.com/yt-dlp/yt-dlp/wiki/FAQ#how-do-i-pass-cookies-to-yt-dlp for how to manually pass cookies. "
            "Otherwise, if the post is accessible in browser without being logged-in, please report this issue on "
            "https://github.com/yt-dlp/yt-dlp/issues?q= , filling out the appropriate issue template. "
            "Confirm you are on the latest version using yt-dlp -U"
        )
        translated = translate_extractor_error(raw_error)
        self.assertIn("Instagram requiere inicio de sesión", translated)
        self.assertNotIn("yt-dlp -U", translated)
        self.assertNotIn("github.com", translated)

    def test_translate_private_post(self):
        raw_error = Exception("This content is only available for registered users who follow this account")
        translated = translate_extractor_error(raw_error)
        self.assertIn("cuenta privada", translated)

    def test_translate_youtube_age_restriction(self):
        raw_error = Exception("Sign in to confirm your age")
        translated = translate_extractor_error(raw_error)
        self.assertIn("verificación de edad", translated)

    def test_translate_timeout(self):
        raw_error = Exception("Connection timed out after 15 seconds")
        translated = translate_extractor_error(raw_error)
        self.assertIn("tiempo de espera", translated)

    def test_cookies_path_detection(self):
        # Should return None if no cookies file exists
        path = get_cookies_path()
        if path:
            self.assertTrue(os.path.exists(path))

if __name__ == "__main__":
    unittest.main()
