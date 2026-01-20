"""
목 데이터 생성 스크립트
1,000개의 실제 음악 역사 앨범 데이터를 생성하고 DB에 주입
"""
import asyncio
import sys
import os

# 상위 디렉토리를 path에 추가
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.ext.asyncio import AsyncSession
from app.database import AsyncSessionLocal, engine, Base
from app.models import AlbumGroup, MapNode, Release
import uuid
import random

# 실제 음악 역사의 유명 앨범 데이터
ALBUMS_DATA = [
    # 1960s - Rock & Pop
    ("The Beatles", "Abbey Road", 1969, "Rock", 0.5, "Europe", "UK", 0.95),
    ("The Beatles", "Sgt. Pepper's Lonely Hearts Club Band", 1967, "Rock", 0.6, "Europe", "UK", 0.98),
    ("The Beatles", "Revolver", 1966, "Rock", 0.55, "Europe", "UK", 0.92),
    ("The Beatles", "Rubber Soul", 1965, "Rock", 0.5, "Europe", "UK", 0.88),
    ("The Beatles", "Help!", 1965, "Rock", 0.5, "Europe", "UK", 0.82),
    ("The Rolling Stones", "Let It Bleed", 1969, "Rock", 0.65, "Europe", "UK", 0.89),
    ("The Rolling Stones", "Beggars Banquet", 1968, "Rock", 0.63, "Europe", "UK", 0.87),
    ("Led Zeppelin", "Led Zeppelin", 1969, "Rock", 0.75, "Europe", "UK", 0.91),
    ("The Doors", "The Doors", 1967, "Rock", 0.62, "North America", "USA", 0.88),
    ("The Doors", "Strange Days", 1967, "Rock", 0.64, "North America", "USA", 0.83),
    ("Jimi Hendrix", "Are You Experienced", 1967, "Rock", 0.78, "North America", "USA", 0.94),
    ("Jimi Hendrix", "Electric Ladyland", 1968, "Rock", 0.8, "North America", "USA", 0.91),
    ("Pink Floyd", "The Piper at the Gates of Dawn", 1967, "Psychedelic", 0.58, "Europe", "UK", 0.85),
    ("Cream", "Disraeli Gears", 1967, "Rock", 0.72, "Europe", "UK", 0.84),
    ("The Velvet Underground", "The Velvet Underground & Nico", 1967, "Rock", 0.55, "North America", "USA", 0.89),
    ("Bob Dylan", "Highway 61 Revisited", 1965, "Folk Rock", 0.48, "North America", "USA", 0.93),
    ("Bob Dylan", "Blonde on Blonde", 1966, "Folk Rock", 0.5, "North America", "USA", 0.91),
    ("The Beach Boys", "Pet Sounds", 1966, "Pop", 0.45, "North America", "USA", 0.95),
    ("Simon & Garfunkel", "Bridge over Troubled Water", 1970, "Folk", 0.35, "North America", "USA", 0.88),
    
    # 1970s - Rock, Progressive, Funk
    ("Led Zeppelin", "Led Zeppelin IV", 1971, "Rock", 0.77, "Europe", "UK", 0.97),
    ("Pink Floyd", "The Dark Side of the Moon", 1973, "Progressive Rock", 0.62, "Europe", "UK", 0.99),
    ("Pink Floyd", "Wish You Were Here", 1975, "Progressive Rock", 0.6, "Europe", "UK", 0.94),
    ("Pink Floyd", "The Wall", 1979, "Progressive Rock", 0.65, "Europe", "UK", 0.96),
    ("Queen", "A Night at the Opera", 1975, "Rock", 0.68, "Europe", "UK", 0.92),
    ("David Bowie", "The Rise and Fall of Ziggy Stardust", 1972, "Glam Rock", 0.7, "Europe", "UK", 0.95),
    ("David Bowie", "Heroes", 1977, "Art Rock", 0.68, "Europe", "UK", 0.91),
    ("Fleetwood Mac", "Rumours", 1977, "Rock", 0.58, "North America", "USA", 0.96),
    ("The Eagles", "Hotel California", 1976, "Rock", 0.55, "North America", "USA", 0.93),
    ("Stevie Wonder", "Songs in the Key of Life", 1976, "Soul", 0.52, "North America", "USA", 0.94),
    ("Marvin Gaye", "What's Going On", 1971, "Soul", 0.48, "North America", "USA", 0.96),
    ("Curtis Mayfield", "Super Fly", 1972, "Funk", 0.65, "North America", "USA", 0.85),
    ("Parliament", "Mothership Connection", 1975, "Funk", 0.75, "North America", "USA", 0.87),
    ("Miles Davis", "Bitches Brew", 1970, "Jazz Fusion", 0.72, "North America", "USA", 0.93),
    ("Herbie Hancock", "Head Hunters", 1973, "Jazz Fusion", 0.73, "North America", "USA", 0.89),
    ("Yes", "Close to the Edge", 1972, "Progressive Rock", 0.64, "Europe", "UK", 0.88),
    ("King Crimson", "In the Court of the Crimson King", 1969, "Progressive Rock", 0.66, "Europe", "UK", 0.91),
    ("Genesis", "Selling England by the Pound", 1973, "Progressive Rock", 0.62, "Europe", "UK", 0.84),
    ("Black Sabbath", "Paranoid", 1970, "Metal", 0.82, "Europe", "UK", 0.92),
    ("Deep Purple", "Machine Head", 1972, "Rock", 0.78, "Europe", "UK", 0.87),
    
    # 1980s - New Wave, Pop, Hip Hop
    ("Michael Jackson", "Thriller", 1982, "Pop", 0.72, "North America", "USA", 0.99),
    ("Michael Jackson", "Bad", 1987, "Pop", 0.74, "North America", "USA", 0.94),
    ("Prince", "Purple Rain", 1984, "Pop", 0.7, "North America", "USA", 0.96),
    ("Madonna", "Like a Virgin", 1984, "Pop", 0.68, "North America", "USA", 0.89),
    ("U2", "The Joshua Tree", 1987, "Rock", 0.65, "Europe", "Ireland", 0.97),
    ("The Smiths", "The Queen Is Dead", 1986, "Alternative Rock", 0.58, "Europe", "UK", 0.91),
    ("The Cure", "Disintegration", 1989, "Alternative Rock", 0.55, "Europe", "UK", 0.89),
    ("R.E.M.", "Murmur", 1983, "Alternative Rock", 0.52, "North America", "USA", 0.84),
    ("Talking Heads", "Remain in Light", 1980, "New Wave", 0.68, "North America", "USA", 0.92),
    ("The Police", "Synchronicity", 1983, "Rock", 0.66, "Europe", "UK", 0.91),
    ("Dire Straits", "Brothers in Arms", 1985, "Rock", 0.58, "Europe", "UK", 0.88),
    ("Bruce Springsteen", "Born in the U.S.A.", 1984, "Rock", 0.64, "North America", "USA", 0.93),
    ("Guns N' Roses", "Appetite for Destruction", 1987, "Rock", 0.8, "North America", "USA", 0.95),
    ("Metallica", "Master of Puppets", 1986, "Metal", 0.88, "North America", "USA", 0.94),
    ("Iron Maiden", "The Number of the Beast", 1982, "Metal", 0.85, "Europe", "UK", 0.9),
    ("Run-DMC", "Raising Hell", 1986, "Hip Hop", 0.78, "North America", "USA", 0.87),
    ("Public Enemy", "It Takes a Nation of Millions", 1988, "Hip Hop", 0.82, "North America", "USA", 0.93),
    ("N.W.A", "Straight Outta Compton", 1988, "Hip Hop", 0.85, "North America", "USA", 0.91),
    ("Beastie Boys", "Licensed to Ill", 1986, "Hip Hop", 0.76, "North America", "USA", 0.86),
    ("Depeche Mode", "Violator", 1990, "Electronic", 0.72, "Europe", "UK", 0.9),
    
    # 1990s - Grunge, Britpop, Hip Hop
    ("Nirvana", "Nevermind", 1991, "Grunge", 0.78, "North America", "USA", 0.98),
    ("Pearl Jam", "Ten", 1991, "Grunge", 0.76, "North America", "USA", 0.92),
    ("Soundgarden", "Superunknown", 1994, "Grunge", 0.8, "North America", "USA", 0.88),
    ("Alice in Chains", "Dirt", 1992, "Grunge", 0.82, "North America", "USA", 0.89),
    ("Radiohead", "OK Computer", 1997, "Alternative Rock", 0.65, "Europe", "UK", 0.98),
    ("Radiohead", "The Bends", 1995, "Alternative Rock", 0.68, "Europe", "UK", 0.91),
    ("Oasis", "Definitely Maybe", 1994, "Britpop", 0.7, "Europe", "UK", 0.9),
    ("Oasis", "(What's the Story) Morning Glory?", 1995, "Britpop", 0.68, "Europe", "UK", 0.95),
    ("Blur", "Parklife", 1994, "Britpop", 0.66, "Europe", "UK", 0.88),
    ("Pulp", "Different Class", 1995, "Britpop", 0.64, "Europe", "UK", 0.86),
    ("The Verve", "Urban Hymns", 1997, "Britpop", 0.62, "Europe", "UK", 0.89),
    ("R.E.M.", "Automatic for the People", 1992, "Alternative Rock", 0.5, "North America", "USA", 0.91),
    ("The Smashing Pumpkins", "Siamese Dream", 1993, "Alternative Rock", 0.74, "North America", "USA", 0.89),
    ("Beck", "Odelay", 1996, "Alternative Rock", 0.68, "North America", "USA", 0.86),
    ("Dr. Dre", "The Chronic", 1992, "Hip Hop", 0.76, "North America", "USA", 0.94),
    ("Nas", "Illmatic", 1994, "Hip Hop", 0.72, "North America", "USA", 0.96),
    ("The Notorious B.I.G.", "Ready to Die", 1994, "Hip Hop", 0.74, "North America", "USA", 0.95),
    ("Wu-Tang Clan", "Enter the Wu-Tang", 1993, "Hip Hop", 0.78, "North America", "USA", 0.93),
    ("A Tribe Called Quest", "The Low End Theory", 1991, "Hip Hop", 0.7, "North America", "USA", 0.92),
    ("Lauryn Hill", "The Miseducation of Lauryn Hill", 1998, "Hip Hop", 0.65, "North America", "USA", 0.94),
    ("OutKast", "Aquemini", 1998, "Hip Hop", 0.73, "North America", "USA", 0.9),
    ("Daft Punk", "Homework", 1997, "Electronic", 0.82, "Europe", "France", 0.91),
    ("The Prodigy", "The Fat of the Land", 1997, "Electronic", 0.88, "Europe", "UK", 0.89),
    ("Portishead", "Dummy", 1994, "Trip Hop", 0.58, "Europe", "UK", 0.92),
    ("Massive Attack", "Blue Lines", 1991, "Trip Hop", 0.6, "Europe", "UK", 0.91),
    
    # 2000s - Indie, Electronic, Hip Hop
    ("Radiohead", "Kid A", 2000, "Electronic", 0.68, "Europe", "UK", 0.96),
    ("The Strokes", "Is This It", 2001, "Indie Rock", 0.72, "North America", "USA", 0.93),
    ("The White Stripes", "White Blood Cells", 2001, "Garage Rock", 0.76, "North America", "USA", 0.89),
    ("Arctic Monkeys", "Whatever People Say I Am", 2006, "Indie Rock", 0.74, "Europe", "UK", 0.92),
    ("Arcade Fire", "Funeral", 2004, "Indie Rock", 0.65, "North America", "Canada", 0.91),
    ("Interpol", "Turn On the Bright Lights", 2002, "Post-Punk Revival", 0.64, "North America", "USA", 0.88),
    ("Yeah Yeah Yeahs", "Fever to Tell", 2003, "Indie Rock", 0.75, "North America", "USA", 0.85),
    ("The Killers", "Hot Fuss", 2004, "Indie Rock", 0.7, "North America", "USA", 0.87),
    ("Kings of Leon", "Only by the Night", 2008, "Rock", 0.68, "North America", "USA", 0.84),
    ("Muse", "Absolution", 2003, "Alternative Rock", 0.78, "Europe", "UK", 0.89),
    ("Coldplay", "A Rush of Blood to the Head", 2002, "Alternative Rock", 0.55, "Europe", "UK", 0.92),
    ("Eminem", "The Marshall Mathers LP", 2000, "Hip Hop", 0.76, "North America", "USA", 0.97),
    ("Jay-Z", "The Blueprint", 2001, "Hip Hop", 0.72, "North America", "USA", 0.94),
    ("Kanye West", "The College Dropout", 2004, "Hip Hop", 0.7, "North America", "USA", 0.95),
    ("Kanye West", "Late Registration", 2005, "Hip Hop", 0.72, "North America", "USA", 0.93),
    ("OutKast", "Speakerboxxx/The Love Below", 2003, "Hip Hop", 0.74, "North America", "USA", 0.96),
    ("50 Cent", "Get Rich or Die Tryin'", 2003, "Hip Hop", 0.78, "North America", "USA", 0.91),
    ("Lil Wayne", "Tha Carter III", 2008, "Hip Hop", 0.75, "North America", "USA", 0.89),
    ("Daft Punk", "Discovery", 2001, "Electronic", 0.8, "Europe", "France", 0.95),
    ("Justice", "Cross", 2007, "Electronic", 0.85, "Europe", "France", 0.87),
    ("LCD Soundsystem", "Sound of Silver", 2007, "Electronic", 0.73, "North America", "USA", 0.9),
    ("The Chemical Brothers", "Surrender", 1999, "Electronic", 0.82, "Europe", "UK", 0.88),
    ("Gorillaz", "Demon Days", 2005, "Alternative", 0.68, "Europe", "UK", 0.91),
    ("Amy Winehouse", "Back to Black", 2006, "Soul", 0.52, "Europe", "UK", 0.93),
    
    # 2010s - Indie, Hip Hop, Electronic
    ("Kanye West", "My Beautiful Dark Twisted Fantasy", 2010, "Hip Hop", 0.75, "North America", "USA", 0.98),
    ("Kendrick Lamar", "good kid, m.A.A.d city", 2012, "Hip Hop", 0.73, "North America", "USA", 0.96),
    ("Kendrick Lamar", "To Pimp a Butterfly", 2015, "Hip Hop", 0.7, "North America", "USA", 0.98),
    ("Drake", "Take Care", 2011, "Hip Hop", 0.68, "North America", "Canada", 0.94),
    ("Frank Ocean", "Channel Orange", 2012, "R&B", 0.58, "North America", "USA", 0.93),
    ("Frank Ocean", "Blonde", 2016, "R&B", 0.55, "North America", "USA", 0.95),
    ("The Weeknd", "House of Balloons", 2011, "R&B", 0.62, "North America", "Canada", 0.89),
    ("Childish Gambino", "Because the Internet", 2013, "Hip Hop", 0.71, "North America", "USA", 0.86),
    ("Tyler, The Creator", "Flower Boy", 2017, "Hip Hop", 0.68, "North America", "USA", 0.88),
    ("Bon Iver", "Bon Iver", 2011, "Indie Folk", 0.42, "North America", "USA", 0.9),
    ("Fleet Foxes", "Helplessness Blues", 2011, "Indie Folk", 0.45, "North America", "USA", 0.87),
    ("Vampire Weekend", "Modern Vampires of the City", 2013, "Indie Rock", 0.64, "North America", "USA", 0.89),
    ("Tame Impala", "Lonerism", 2012, "Psychedelic Rock", 0.67, "Oceania", "Australia", 0.88),
    ("Tame Impala", "Currents", 2015, "Psychedelic Rock", 0.7, "Oceania", "Australia", 0.91),
    ("Arctic Monkeys", "AM", 2013, "Indie Rock", 0.72, "Europe", "UK", 0.92),
    ("The xx", "xx", 2009, "Indie Pop", 0.52, "Europe", "UK", 0.88),
    ("Lorde", "Pure Heroine", 2013, "Pop", 0.65, "Oceania", "New Zealand", 0.89),
    ("Lana Del Rey", "Born to Die", 2012, "Pop", 0.55, "North America", "USA", 0.87),
    ("Daft Punk", "Random Access Memories", 2013, "Electronic", 0.72, "Europe", "France", 0.94),
    ("James Blake", "James Blake", 2011, "Electronic", 0.58, "Europe", "UK", 0.86),
    ("FKA twigs", "LP1", 2014, "Electronic", 0.68, "Europe", "UK", 0.84),
    ("CHVRCHES", "The Bones of What You Believe", 2013, "Electronic", 0.75, "Europe", "UK", 0.85),
    ("Father John Misty", "I Love You, Honeybear", 2015, "Indie Rock", 0.54, "North America", "USA", 0.83),
    ("St. Vincent", "St. Vincent", 2014, "Art Rock", 0.68, "North America", "USA", 0.86),
    ("Mac DeMarco", "Salad Days", 2014, "Indie Rock", 0.56, "North America", "Canada", 0.82),
    
    # 2020s - Contemporary
    ("Taylor Swift", "folklore", 2020, "Indie Folk", 0.48, "North America", "USA", 0.95),
    ("The Weeknd", "After Hours", 2020, "R&B", 0.68, "North America", "Canada", 0.93),
    ("Dua Lipa", "Future Nostalgia", 2020, "Pop", 0.75, "Europe", "UK", 0.91),
    ("Billie Eilish", "Happier Than Ever", 2021, "Pop", 0.58, "North America", "USA", 0.89),
    ("Olivia Rodrigo", "SOUR", 2021, "Pop Rock", 0.68, "North America", "USA", 0.92),
    ("Lil Nas X", "MONTERO", 2021, "Hip Hop", 0.76, "North America", "USA", 0.87),
    ("Tyler, The Creator", "Call Me If You Get Lost", 2021, "Hip Hop", 0.72, "North America", "USA", 0.9),
    ("Adele", "30", 2021, "Pop", 0.52, "Europe", "UK", 0.94),
]

# 추가 앨범 생성을 위한 템플릿 (다양성 확보)
ADDITIONAL_ARTISTS = [
    ("Arcade Fire", ["The Suburbs", "Reflektor", "Everything Now"], "Indie Rock", 0.66, "North America", "Canada"),
    ("Radiohead", ["In Rainbows", "Hail to the Thief", "Amnesiac"], "Alternative Rock", 0.64, "Europe", "UK"),
    ("Foo Fighters", ["The Colour and the Shape", "There Is Nothing Left to Lose", "Wasting Light"], "Rock", 0.72, "North America", "USA"),
    ("Red Hot Chili Peppers", ["Blood Sugar Sex Magik", "Californication", "By the Way"], "Rock", 0.7, "North America", "USA"),
    ("Green Day", ["Dookie", "American Idiot", "21st Century Breakdown"], "Punk Rock", 0.78, "North America", "USA"),
    ("Blink-182", ["Enema of the State", "Take Off Your Pants and Jacket", "Blink-182"], "Punk Rock", 0.76, "North America", "USA"),
    ("Linkin Park", ["Hybrid Theory", "Meteora", "Minutes to Midnight"], "Nu Metal", 0.82, "North America", "USA"),
    ("Korn", ["Korn", "Follow the Leader", "Issues"], "Nu Metal", 0.85, "North America", "USA"),
    ("System of a Down", ["Toxicity", "Mezmerize", "Hypnotize"], "Metal", 0.88, "North America", "USA"),
    ("Slipknot", ["Iowa", "Vol. 3: The Subliminal Verses", "All Hope Is Gone"], "Metal", 0.9, "North America", "USA"),
    ("Rammstein", ["Mutter", "Reise, Reise", "Liebe ist für alle da"], "Industrial Metal", 0.87, "Europe", "Germany"),
    ("Nine Inch Nails", ["The Downward Spiral", "The Fragile", "With Teeth"], "Industrial Rock", 0.83, "North America", "USA"),
    ("Björk", ["Homogenic", "Vespertine", "Medúlla"], "Art Pop", 0.62, "Europe", "Iceland"),
    ("Massive Attack", ["Mezzanine", "100th Window", "Heligoland"], "Trip Hop", 0.62, "Europe", "UK"),
    ("Moby", ["Play", "18", "Hotel"], "Electronic", 0.68, "North America", "USA"),
    ("Aphex Twin", ["Selected Ambient Works 85-92", "Richard D. James Album", "Drukqs"], "Electronic", 0.75, "Europe", "UK"),
    ("Boards of Canada", ["Music Has the Right to Children", "Geogaddi", "The Campfire Headphase"], "Electronic", 0.58, "Europe", "UK"),
    ("Flying Lotus", ["Cosmogramma", "Until the Quiet Comes", "You're Dead!"], "Electronic", 0.73, "North America", "USA"),
    ("J Dilla", ["Donuts", "The Shining", "Ruff Draft"], "Hip Hop", 0.68, "North America", "USA"),
    ("MF DOOM", ["Madvillainy", "MM..FOOD", "Born Like This"], "Hip Hop", 0.72, "North America", "USA"),
    ("Clams Casino", ["Instrumentals", "Instrumentals 2", "32 Levels"], "Hip Hop", 0.65, "North America", "USA"),
    ("Anderson .Paak", ["Malibu", "Oxnard", "Ventura"], "R&B", 0.64, "North America", "USA"),
    ("SZA", ["Ctrl", "SOS"], "R&B", 0.6, "North America", "USA"),
    ("H.E.R.", ["H.E.R.", "I Used to Know Her"], "R&B", 0.58, "North America", "USA"),
    ("Janelle Monáe", ["The ArchAndroid", "The Electric Lady", "Dirty Computer"], "R&B", 0.68, "North America", "USA"),
    ("Solange", ["A Seat at the Table", "When I Get Home"], "R&B", 0.56, "North America", "USA"),
    ("D'Angelo", ["Brown Sugar", "Voodoo", "Black Messiah"], "Soul", 0.54, "North America", "USA"),
    ("Erykah Badu", ["Baduizm", "Mama's Gun", "Worldwide Underground"], "Soul", 0.52, "North America", "USA"),
    ("Maxwell", ["Maxwell's Urban Hang Suite", "Embrya", "BLACKsummers'night"], "Soul", 0.5, "North America", "USA"),
    ("Alicia Keys", ["Songs in A Minor", "The Diary of Alicia Keys", "As I Am"], "R&B", 0.55, "North America", "USA"),
    ("John Mayer", ["Room for Squares", "Continuum", "Born and Raised"], "Pop Rock", 0.52, "North America", "USA"),
    ("Jack White", ["Blunderbuss", "Lazaretto", "Boarding House Reach"], "Rock", 0.74, "North America", "USA"),
    ("Black Keys", ["Brothers", "El Camino", "Turn Blue"], "Blues Rock", 0.7, "North America", "USA"),
    ("Cage the Elephant", ["Melophobia", "Tell Me I'm Pretty", "Social Cues"], "Alternative Rock", 0.72, "North America", "USA"),
    ("Portugal. The Man", ["Woodstock", "In the Mountain in the Cloud"], "Indie Rock", 0.66, "North America", "USA"),
    ("Foster the People", ["Torches", "Supermodel", "Sacred Hearts Club"], "Indie Pop", 0.68, "North America", "USA"),
    ("MGMT", ["Oracular Spectacular", "Congratulations", "MGMT"], "Psychedelic Pop", 0.7, "North America", "USA"),
    ("Phoenix", ["Wolfgang Amadeus Phoenix", "Bankrupt!", "Ti Amo"], "Indie Pop", 0.66, "Europe", "France"),
    ("Two Door Cinema Club", ["Tourist History", "Beacon", "Gameshow"], "Indie Rock", 0.72, "Europe", "Ireland"),
    ("Alt-J", ["An Awesome Wave", "This Is All Yours", "Relaxer"], "Indie Rock", 0.64, "Europe", "UK"),
]

async def create_mock_albums():
    """목 앨범 데이터 생성 및 DB 주입"""
    
    # 테이블 재생성 (개발 환경용)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    async with AsyncSessionLocal() as session:
        albums = []
        nodes = []
        releases = []
        
        # 기본 앨범 추가
        for idx, (artist, title, year, genre, vibe, region, country, popularity) in enumerate(ALBUMS_DATA):
            album_id = f"album_{idx+1:04d}"
            album = AlbumGroup(
                album_group_id=album_id,
                title=title,
                primary_artist_display=artist,
                original_year=year,
                primary_genre=genre,
                country_code=country,
                popularity=popularity,
                cover_url=f"https://picsum.photos/300/300?random={idx+1}"
            )
            node = MapNode(
                album_group_id=album_id,
                x=year,
                y=vibe,
                size=(popularity * 10) + 2
            )
            release = Release(
                release_id=f"local:release:{uuid.uuid4()}",
                album_group_id=album_id,
                release_title=title
            )
            albums.append(album)
            nodes.append(node)
            releases.append(release)
        
        # 추가 앨범 생성 (목표 1000개까지)
        current_idx = len(ALBUMS_DATA)
        for artist, album_titles, genre, base_vibe, region, country in ADDITIONAL_ARTISTS:
            for i, title in enumerate(album_titles):
                # 연도를 다양하게 분산 (1990-2024)
                year = random.randint(1990, 2024)
                vibe = base_vibe + random.uniform(-0.05, 0.05)
                vibe = max(0.0, min(1.0, vibe))  # 0-1 범위 제한
                popularity = random.uniform(0.6, 0.95)
                
                album_id = f"album_{current_idx+1:04d}"
                album = AlbumGroup(
                    album_group_id=album_id,
                    title=title,
                    primary_artist_display=artist,
                    original_year=year,
                    primary_genre=genre,
                    country_code=country,
                    popularity=popularity,
                    cover_url=f"https://picsum.photos/300/300?random={current_idx+1}"
                )
                node = MapNode(
                    album_group_id=album_id,
                    x=year,
                    y=vibe,
                    size=(popularity * 10) + 2
                )
                release = Release(
                    release_id=f"local:release:{uuid.uuid4()}",
                    album_group_id=album_id,
                    release_title=title
                )
                albums.append(album)
                nodes.append(node)
                releases.append(release)
                album = AlbumGroup(
                    album_group_id=album_id,
                    title=title,
                    primary_artist_display=artist,
                    original_year=year,
                    primary_genre=genre,
                    country_code=country,
                    popularity=popularity,
                    cover_url=f"https://picsum.photos/300/300?random={current_idx+1}"
                )
                node = MapNode(
                    album_group_id=album_id,
                    x=year,
                    y=vibe,
                    size=(popularity * 10) + 2
                )
                release = Release(
                    release_id=f"local:release:{uuid.uuid4()}",
                    album_group_id=album_id,
                    release_title=title
                )
                albums.append(album)
                nodes.append(node)
                releases.append(release)
                current_idx += 1
        
        # 랜덤 앨범으로 1000개 채우기
        genres_pool = [
            ("Rock", 0.7, ["North America", "Europe"]),
            ("Pop", 0.65, ["North America", "Europe", "Asia"]),
            ("Hip Hop", 0.75, ["North America"]),
            ("Electronic", 0.78, ["Europe", "North America"]),
            ("Jazz", 0.55, ["North America"]),
            ("Classical", 0.3, ["Europe"]),
            ("Blues", 0.5, ["North America"]),
            ("Country", 0.45, ["North America"]),
            ("Reggae", 0.62, ["Caribbean"]),
            ("Latin", 0.68, ["South America"]),
            ("K-Pop", 0.78, ["Asia"]),
            ("J-Pop", 0.72, ["Asia"]),
            ("Indie Rock", 0.68, ["North America", "Europe"]),
            ("Metal", 0.85, ["Europe", "North America"]),
            ("Punk", 0.8, ["North America", "Europe"]),
        ]
        
        artist_names = [
            "The Soundscapes", "Echo Chamber", "Neon Dreams", "Velvet Underground Revival",
            "Crystal Method", "Analog Future", "Digital Natives", "Reverb Nation",
            "Sonic Youth Jr.", "The Harmonics", "Wavelength", "Frequency Shift",
            "The Amplifiers", "Decibel Rising", "Resonance", "The Oscillators",
            "Tempo Changes", "The Rhythmics", "Beat Collective", "The Syncopators",
            "Groove Theory", "The Melodies", "Chord Progressions", "Scale Runners",
            "The Cadences", "Pitch Perfect", "The Intervals", "Major Sevenths",
            "Minor Keys", "The Dynamics", "Crescendo", "The Arpeggios",
            "Timbre", "The Overtones", "Harmonic Series", "The Fundamentals",
            "Acoustic Waves", "The Frequencies", "Sonic Boom", "The Vibrations",
        ]
        
        while len(albums) < 1000:
            artist = random.choice(artist_names)
            genre_name, base_vibe, regions = random.choice(genres_pool)
            region = random.choice(regions)
            
            # 국가 매핑
            country_map = {
                "North America": ["USA", "Canada", "Mexico"],
                "Europe": ["UK", "France", "Germany", "Italy", "Spain", "Sweden"],
                "Asia": ["South Korea", "Japan", "China", "India"],
                "South America": ["Brazil", "Argentina", "Colombia"],
                "Caribbean": ["Jamaica", "Cuba", "Trinidad"],
                "Oceania": ["Australia", "New Zealand"],
            }
            country = random.choice(country_map.get(region, ["USA"]))
            
            year = random.randint(1960, 2024)
            vibe = base_vibe + random.uniform(-0.1, 0.1)
            vibe = max(0.0, min(1.0, vibe))
            popularity = random.uniform(0.3, 0.9)
            
            # 앨범 제목 생성
            title_templates = [
                "Volume {}", "Chapter {}", "Session {}", "Collection {}",
                "Works {}", "Recordings {}", "The {} Album", "Study No. {}",
                "Opus {}", "Suite {}", "Symphony {}", "Overture {}",
            ]
            title = random.choice(title_templates).format(random.randint(1, 20))
            
            album_id = f"album_{len(albums)+1:04d}"
            album = AlbumGroup(
                album_group_id=album_id,
                title=title,
                primary_artist_display=artist,
                original_year=year,
                primary_genre=genre_name,
                country_code=country,
                popularity=popularity,
                cover_url=f"https://picsum.photos/300/300?random={len(albums)+1}"
            )
            node = MapNode(
                album_group_id=album_id,
                x=year,
                y=vibe,
                size=(popularity * 10) + 2
            )
            release = Release(
                release_id=f"local:release:{uuid.uuid4()}",
                album_group_id=album_id,
                release_title=title
            )
            albums.append(album)
            nodes.append(node)
            releases.append(release)
        
        # 배치 추가
        session.add_all(albums)
        session.add_all(nodes)
        session.add_all(releases)
        await session.commit()
        
        print(f"✅ {len(albums)}개의 앨범 데이터가 성공적으로 추가되었습니다!")
        print(f"📊 연도 범위: {min(a.year for a in albums)} - {max(a.year for a in albums)}")
        print(f"🎵 장르 수: {len(set(a.genre for a in albums))}")
        print(f"🌍 지역 수: {len(set(a.region_bucket for a in albums))}")

if __name__ == "__main__":
    print("🚀 SonicChronos 목 데이터 생성 시작...")
    asyncio.run(create_mock_albums())
    print("✅ 완료!")
