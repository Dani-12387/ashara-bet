import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './MatchesManagement.css';

const MatchesManagement = () => {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingMatch, setEditingMatch] = useState(null);
  const [filters, setFilters] = useState({
    sport: 'FOOTBALL',
    status: '',
    dateFrom: '',
    dateTo: ''
  });

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  // ✅ 2026/27 Clubs by League
  const clubsByLeague = {
    // Premier League (England) - 2026/27
    'Premier League': [
      'Arsenal', 'Aston Villa', 'Bournemouth', 'Brentford', 'Brighton',
      'Chelsea', 'Crystal Palace', 'Everton', 'Fulham', 'Ipswich Town',
      'Liverpool', 'Manchester City', 'Manchester United', 'Newcastle United',
      'Nottingham Forest', 'Sunderland', 'Tottenham Hotspur', 'Coventry City',
      'Hull City', 'Leicester City'
    ],
    'Championship': [
      'Blackburn Rovers', 'Bristol City', 'Burnley', 'Cardiff City', 'Derby County',
      'Huddersfield Town', 'Leeds United', 'Luton Town', 'Middlesbrough', 'Millwall',
      'Norwich City', 'Oxford United', 'Plymouth Argyle', 'Portsmouth', 'Preston North End',
      'Queens Park Rangers', 'Sheffield United', 'Sheffield Wednesday', 'Stoke City',
      'Swansea City', 'Watford', 'West Bromwich Albion', 'Wigan Athletic', 'Wrexham'
    ],
    'FA Cup': [
      'Arsenal', 'Aston Villa', 'Bournemouth', 'Brentford', 'Brighton',
      'Chelsea', 'Crystal Palace', 'Everton', 'Fulham', 'Liverpool',
      'Manchester City', 'Manchester United', 'Newcastle United', 'Tottenham Hotspur',
      'West Ham United', 'Wolverhampton Wanderers'
    ],
    'EFL Cup': [
      'Arsenal', 'Aston Villa', 'Bournemouth', 'Brentford', 'Brighton',
      'Chelsea', 'Crystal Palace', 'Everton', 'Fulham', 'Liverpool',
      'Manchester City', 'Manchester United', 'Newcastle United', 'Tottenham Hotspur'
    ],
    'Community Shield': [
      'Manchester City', 'Arsenal'
    ],

    // Bundesliga (Germany) - 2026/27
    'Bundesliga': [
      'Augsburg', 'Union Berlin', 'Werder Bremen', 'Borussia Dortmund',
      'SV Elversberg', 'Eintracht Frankfurt', 'Freiburg', 'Hamburger SV',
      'Hoffenheim', 'FC Köln', 'RB Leipzig', 'Bayer Leverkusen', 'Mainz',
      'Borussia Mönchengladbach', 'Bayern Munich', 'SC Paderborn', 'Schalke 04',
      'VfB Stuttgart'
    ],
    '2. Bundesliga': [
      'Darmstadt 98', 'Fortuna Düsseldorf', 'Greuther Fürth', 'Hannover 96',
      'Hertha BSC', 'Kaiserslautern', 'Karlsruher SC', 'Magdeburg', 'Nürnberg',
      'Preußen Münster', 'Regensburg', 'Sandhausen', 'St. Pauli', 'Ulm'
    ],
    'DFB-Pokal': [
      'Bayern Munich', 'Borussia Dortmund', 'RB Leipzig', 'Bayer Leverkusen',
      'Eintracht Frankfurt', 'Freiburg', 'Union Berlin', 'VfB Stuttgart'
    ],
    'DFL-Supercup': [
      'Bayer Leverkusen', 'Bayern Munich'
    ],

    // Eredivisie (Netherlands) - 2026/27
    'Eredivisie': [
      'ADO Den Haag', 'Ajax', 'AZ Alkmaar', 'Excelsior', 'FC Groningen',
      'FC Twente', 'FC Utrecht', 'Feyenoord', 'Fortuna Sittard', 'Go Ahead Eagles',
      'NEC Nijmegen', 'PEC Zwolle', 'PSV Eindhoven', 'SC Cambuur', 'SC Heerenveen',
      'Sparta Rotterdam', 'Telstar', 'Willem II'
    ],
    'Eerste Divisie': [
      'De Graafschap', 'Dordrecht', 'Emmen', 'FC Eindhoven', 'FC Volendam',
      'Helmond Sport', 'Jong Ajax', 'Jong AZ', 'Jong PSV', 'Jong Utrecht',
      'MVV Maastricht', 'Roda JC', 'TOP Oss', 'VVV-Venlo'
    ],
    'KNVB Cup': [
      'Ajax', 'Feyenoord', 'PSV Eindhoven', 'AZ Alkmaar', 'FC Twente',
      'FC Utrecht', 'Groningen', 'Heerenveen'
    ],
    'Johan Cruyff Shield': [
      'PSV Eindhoven', 'Feyenoord'
    ],

    // La Liga (Spain) - 2026/27
    'La Liga': [
      'Athletic Bilbao', 'Atletico Madrid', 'Osasuna', 'Celta Vigo', 'Alaves',
      'Elche', 'Barcelona', 'Getafe', 'Levante', 'Malaga', 'Racing Santander',
      'Rayo Vallecano', 'Deportivo La Coruna', 'Espanyol', 'Real Betis',
      'Real Madrid', 'Real Sociedad', 'Sevilla', 'Valencia', 'Villarreal'
    ],
    'Segunda División': [
      'Albacete', 'Almería', 'Burgos', 'Cartagena', 'Castellón', 'Córdoba',
      'Eibar', 'Eldense', 'FC Andorra', 'Granada', 'Huesca', 'Leganés',
      'Mirandés', 'Oviedo', 'Real Zaragoza', 'Santander', 'Sporting Gijón', 'Tenerife'
    ],
    'Copa del Rey': [
      'Barcelona', 'Real Madrid', 'Atletico Madrid', 'Athletic Bilbao',
      'Real Sociedad', 'Sevilla', 'Valencia', 'Villarreal'
    ],
    'Supercopa de España': [
      'Real Madrid', 'Barcelona'
    ],

    // Liga Portugal (Portugal) - 2026/27
    'Liga Portugal': [
      'Estrela Amadora', 'Estoril', 'Famalicão', 'Gil Vicente', 'Rio Ave',
      'Marítimo', 'Casa Pia', 'Moreirense', 'Braga', 'Porto', 'Alverca',
      'Santa Clara', 'Nacional', 'Benfica', 'Académico de Viseu',
      'Vitória Guimarães', 'Arouca', 'Sporting CP'
    ],
    'Liga Portugal 2': [
      'Académico Viseu', 'Benfica B', 'Chaves', 'Feirense', 'Leixões',
      'Mafra', 'Paços Ferreira', 'Portimonense', 'Tondela', 'Torreense',
      'União Leiria', 'Vizela'
    ],
    'Taça de Portugal': [
      'Porto', 'Benfica', 'Sporting CP', 'Braga', 'Vitória Guimarães'
    ],
    'Supertaça Cândido de Oliveira': [
      'Sporting CP', 'Porto'
    ],

    // Ligue 1 (France) - 2026/27
    'Ligue 1': [
      'Angers', 'Auxerre', 'Brest', 'Le Havre', 'Le Mans', 'Lens',
      'Lorient', 'Lille', 'Lyon', 'Marseille', 'Monaco', 'Nice',
      'Paris FC', 'PSG', 'Rennes', 'Strasbourg', 'Toulouse', 'Troyes'
    ],
    'Ligue 2': [
      'Amiens', 'Annecy', 'Bastia', 'Bordeaux', 'Caen', 'Clermont',
      'Dunkerque', 'Grenoble', 'Guingamp', 'Laval', 'Martigues', 'Metz',
      'Nancy', 'Nîmes', 'Quevilly-Rouen', 'Rodez', 'Saint-Étienne', 'Valenciennes'
    ],
    'Coupe de France': [
      'PSG', 'Marseille', 'Lyon', 'Lille', 'Monaco', 'Nice', 'Rennes', 'Lens'
    ],
    'Trophée des Champions': [
      'PSG', 'Toulouse'
    ],

    // Pro League (Belgium) - 2026/27
    'Pro League': [
      'Anderlecht', 'Antwerp', 'Cercle Brugge', 'Charleroi', 'Club Brugge',
      'Genk', 'Gent', 'Kortrijk', 'Mechelen', 'Westerlo', 'Lommel',
      'OH Leuven', 'RAAL La Louvière', 'Sint-Truiden', 'SK Beveren',
      'Standard Liège', 'Union Saint-Gilloise', 'Zulte Waregem'
    ],
    'Challenger Pro League': [
      'Beerschot', 'Dender', 'Eupen', 'Francs Borains', 'Lierse',
      'Lokeren-Temse', 'Patro Eisden', 'RSCA Futures', 'Royal Antwerp B',
      'Seraing', 'Virton', 'Zulte Waregem B'
    ],
    'Belgian Cup': [
      'Club Brugge', 'Anderlecht', 'Genk', 'Gent', 'Antwerp', 'Standard Liège'
    ],
    'Belgian Super Cup': [
      'Club Brugge', 'Union Saint-Gilloise'
    ],

    // Serie A (Italy) - 2026/27
    'Serie A': [
      'AC Milan', 'Atalanta', 'Bologna', 'Cagliari', 'Como', 'Fiorentina',
      'Frosinone', 'Genoa', 'Inter Milan', 'Juventus', 'Lazio', 'Lecce',
      'Monza', 'Napoli', 'Parma', 'Roma', 'Sassuolo', 'Torino', 'Udinese',
      'Venezia'
    ],
    'Serie B': [
      'Bari', 'Brescia', 'Carrarese', 'Catania', 'Cesena', 'Cittadella',
      'Cremonese', 'Crotone', 'Empoli', 'Modena', 'Palermo', 'Pisa',
      'Reggiana', 'Salernitana', 'Sampdoria', 'Spezia', 'Südtirol', 'Ternana'
    ],
    'Coppa Italia': [
      'Inter Milan', 'AC Milan', 'Juventus', 'Napoli', 'Roma', 'Lazio',
      'Atalanta', 'Fiorentina'
    ],
    'Supercoppa Italiana': [
      'Napoli', 'Inter Milan'
    ],

    // Allsvenskan (Sweden) - 2026
    'Allsvenskan': [
      'AIK', 'BK Häcken', 'Brommapojkarna', 'Degerfors', 'Djurgårdens IF',
      'Elfsborg', 'GAIS', 'Halmstad', 'Hammarby IF', 'IFK Göteborg',
      'Kalmar FF', 'Malmö FF', 'Mjällby AIF', 'Sirius', 'Västerås SK',
      'Örgryte IS'
    ],
    'Superettan': [
      'AFC Eskilstuna', 'Brage', 'Falkenberg', 'Gefle', 'Helsingborg',
      'Jönköpings Södra', 'Landskrona', 'Norrby', 'Oddevold', 'Sandviken',
      'Skövde', 'Trelleborg', 'Utsikten', 'Varbergs BoIS'
    ],
    'Svenska Cupen': [
      'Malmö FF', 'AIK', 'Djurgårdens IF', 'Hammarby IF', 'IFK Göteborg'
    ],
    'Svenska Supercupen': [
      'Malmö FF', 'Elfsborg'
    ],

    // Danish Superliga - 2026/27
    'Danish Superliga': [
      'AGF Aarhus', 'Brøndby IF', 'FC Copenhagen', 'FC Fredericia',
      'FC Midtjylland', 'FC Nordsjælland', 'Odense BK', 'Randers FC',
      'Silkeborg IF', 'Sønderjyske', 'Vejle BK', 'Viborg FF'
    ],
    '1st Division': [
      'AC Horsens', 'B.93', 'Esbjerg', 'FC Roskilde', 'HB Køge', 'Hillerød',
      'Hobro', 'Kolding IF', 'Næstved', 'Vendsyssel FF'
    ],
    'Danish Cup': [
      'FC Copenhagen', 'Brøndby IF', 'FC Midtjylland', 'AGF Aarhus'
    ],
    'Danish Super Cup': [
      'FC Midtjylland', 'FC Copenhagen'
    ],

    // Eliteserien (Norway) - 2026
    'Eliteserien': [
      'Bodø/Glimt', 'Viking', 'Tromsø', 'Lillestrøm', 'Molde', 'Sarpsborg 08',
      'Vålerenga', 'Brann', 'Rosenborg', 'HamKam', 'Sandefjord', 'Fredrikstad',
      'Aalesund', 'KFUM', 'Kristiansund', 'Start'
    ],
    'OBOS-ligaen': [
      'Bryne', 'Egersund', 'Hødd', 'Hønefoss', 'Kongsvinger', 'Mjøndalen',
      'Moss', 'Ranheim', 'Raufoss', 'Sogndal', 'Stabæk', 'Strømmen'
    ],
    'Norwegian Cup': [
      'Molde', 'Bodø/Glimt', 'Brann', 'Rosenborg', 'Vålerenga'
    ],
    'Mesterfinalen': [
      'Bodø/Glimt', 'Molde'
    ],

    // Swiss Super League - 2026/27
    'Swiss Super League': [
      'Grasshoppers', 'St. Gallen', 'FC Thun', 'Lausanne-Sport', 'Luzern',
      'Young Boys', 'Sion', 'FC Zürich', 'Lugano', 'Servette', 'FC Basel',
      'FC Vaduz'
    ],
    'Challenge League': [
      'Aarau', 'Baden', 'Bellinzona', 'Cham', 'Kriens', 'Neuchâtel Xamax',
      'Schaffhausen', 'Stade Nyonnais', 'Wil', 'Winterthur', 'Yverdon-Sport'
    ],
    'Swiss Cup': [
      'Young Boys', 'FC Basel', 'FC Zürich', 'Luzern', 'Servette'
    ],
    'Swiss Super Cup': [
      'Young Boys', 'FC Zürich'
    ],

    // Austrian Bundesliga - 2026/27
    'Austrian Bundesliga': [
      'Red Bull Salzburg', 'Sturm Graz', 'Rapid Wien', 'Austria Wien',
      'Wolfsberger AC', 'TSV Hartberg', 'LASK', 'Austria Klagenfurt',
      'Blau-Weiß Linz', 'WSG Tirol', 'SCR Altach', 'SV Ried'
    ],
    '2. Liga': [
      'Amstetten', 'Bregenz', 'Dornbirn', 'FAC Wien', 'Floridsdorf',
      'Graz AK', 'Horn', 'Kapfenberg', 'Lafnitz', 'Leoben', 'Liefering',
      'Stripfing', 'St. Pölten', 'Voitsberg'
    ],
    'Austrian Cup': [
      'Red Bull Salzburg', 'Sturm Graz', 'Rapid Wien', 'Austria Wien'
    ],
    'Austrian Supercup': [
      'Red Bull Salzburg', 'Sturm Graz'
    ],

    // Super League Greece - 2026/27
    'Super League Greece': [
      'AEK Athens', 'Aris', 'Asteras Tripolis', 'Kifisia', 'Atromitos',
      'Iraklis', 'Levadiakos', 'Kalamata', 'OFI Crete', 'Olympiacos',
      'Panathinaikos', 'Panetolikos', 'PAOK', 'Volos'
    ],
    'Super League Greece 2': [
      'Apollon Smyrnis', 'Chania', 'Diagoras', 'Egaleo', 'Ionikos',
      'Iraklis Larissa', 'Kallithea', 'Larissa', 'Niki Volos', 'Olympiacos B',
      'PAOK B', 'Panathinaikos B', 'PAS Giannina', 'Xanthi'
    ],
    'Greek Cup': [
      'Olympiacos', 'AEK Athens', 'Panathinaikos', 'PAOK', 'Aris'
    ],
    'Greek Super Cup': [
      'Olympiacos', 'AEK Athens'
    ],

    // Süper Lig (Turkey) - 2026/27
    'Süper Lig': [
      'Amedspor', 'Antalyaspor', 'Alanyaspor', 'Başakşehir', 'Beşiktaş',
      'Çorum FK', 'Erzurumspor', 'Fenerbahçe', 'Galatasaray', 'Gaziantep FK',
      'Gençlerbirliği', 'Göztepe', 'Kayserispor', 'Kasımpaşa', 'Konyaspor',
      'Rizespor', 'Samsunspor', 'Trabzonspor'
    ],
    'TFF 1. Lig': [
      'Adanaspor', 'Boluspor', 'Eskişehirspor', 'Giresunspor', 'Keçiörengücü',
      'Manisa FK', 'MKE Ankaragücü', 'Osmangazi', 'Sakaryaspor', 'Sivasspor',
      'Şanlıurfaspor', 'Tuzlaspor', 'Ümraniyespor', 'Yeni Malatyaspor'
    ],
    'Turkish Cup': [
      'Galatasaray', 'Fenerbahçe', 'Beşiktaş', 'Trabzonspor', 'Başakşehir'
    ],
    'Turkish Super Cup': [
      'Galatasaray', 'Fenerbahçe'
    ],

    // Russian Premier League - 2026/27
    'Russian Premier League': [
      'Akhmat Grozny', 'Akron Togliatti', 'Baltika Kaliningrad', 'CSKA Moscow',
      'Dynamo Makhachkala', 'Dynamo Moscow', 'Krasnodar', 'Krylia Sovetov',
      'Lokomotiv Moscow', 'Orenburg', 'Pari Nizhny Novgorod', 'Rostov',
      'Rubin Kazan', 'Sochi', 'Spartak Moscow', 'Zenit'
    ],
    'Russian First League': [
      'Alania Vladikavkaz', 'Arsenal Tula', 'Chaika', 'Chernomorets Novorossiysk',
      'Enisey', 'KAMAZ', 'Khimki', 'Kuban Krasnodar', 'Moscow Torpedo',
      'Neftekhimik', 'Rodina Moscow', 'Shinnik', 'SKA-Khabarovsk', 'Tyumen',
      'Ufa', 'Veles Moscow'
    ],
    'Russian Cup': [
      'Zenit', 'Spartak Moscow', 'CSKA Moscow', 'Lokomotiv Moscow', 'Krasnodar'
    ],
    'Russian Super Cup': [
      'Zenit', 'CSKA Moscow'
    ],

    // Ukrainian Premier League - 2026/27
    'Ukrainian Premier League': [
      'Bukovyna', 'Veres Rivne', 'Dynamo Kyiv', 'Epicentr', 'Zorya Luhansk',
      'Karpaty Lviv', 'Kolos Kovalivka', 'Kryvbas Kryvyi Rih', 'Kudrivka',
      'Livyi Bereh', 'LNZ Cherkasy', 'Obolon Kyiv', 'Polissya Zhytomyr',
      'Metalist 1925 Kharkiv', 'Chornomorets Odesa', 'Shakhtar Donetsk'
    ],
    'Ukrainian First League': [
      'Ahrobiznes Volochysk', 'Bukovyna', 'Chernihiv', 'Girnyk-Sport',
      'Inhulets', 'Kremin', 'Mariupol', 'Metalurh Zaporizhzhia',
      'Mykolaiv', 'Nyva Ternopil', 'Podillya Khmelnytskyi', 'Poltava',
      'Prykarpattia', 'Viktoriya Sumy', 'Vilkhivtsi'
    ],
    'Ukrainian Cup': [
      'Shakhtar Donetsk', 'Dynamo Kyiv', 'Zorya Luhansk', 'Dnipro-1'
    ],
    'Ukrainian Super Cup': [
      'Shakhtar Donetsk', 'Dynamo Kyiv'
    ],

    // Ekstraklasa (Poland) - 2026/27
    'Ekstraklasa': [
      'Zagłębie Lubin', 'Wisła Płock', 'Wisła Kraków', 'Górnik Zabrze',
      'Radomiak Radom', 'Legia Warsaw', 'Jagiellonia Białystok', 'Motor Lublin',
      'Widzew Łódź', 'Lech Poznań', 'Cracovia', 'Raków Częstochowa',
      'Śląsk Wrocław', 'GKS Katowice', 'Wieczysta Kraków', 'Korona Kielce',
      'Pogoń Szczecin', 'Piast Gliwice'
    ],
    'I Liga': [
      'Arka Gdynia', 'Bytovia', 'Chrobry Głogów', 'GKS Tychy', 'Górnik Łęczna',
      'Kotwica Kołobrzeg', 'Lechia Gdańsk', 'Miedź Legnica', 'Odra Opole',
      'Olimpia Grudziądz', 'Pogoń Siedlce', 'Polonia Warsaw', 'Resovia Rzeszów',
      'Ruch Chorzów', 'Stal Rzeszów', 'Znicz Pruszków', 'ŁKS Łódź'
    ],
    'Polish Cup': [
      'Legia Warsaw', 'Lech Poznań', 'Raków Częstochowa', 'Pogoń Szczecin'
    ],
    'Polish Super Cup': [
      'Raków Częstochowa', 'Legia Warsaw'
    ],

    // UEFA Champions League - 2026/27
    'UEFA Champions League': [
      'Real Madrid', 'Barcelona', 'Bayern Munich', 'PSG', 'Manchester City',
      'Liverpool', 'Inter Milan', 'AC Milan', 'Arsenal', 'Chelsea',
      'Borussia Dortmund', 'Atletico Madrid', 'Juventus', 'Napoli',
      'Benfica', 'Porto', 'RB Leipzig', 'Lazio', 'Feyenoord', 'Celtic',
      'Red Star Belgrade', 'Shakhtar Donetsk', 'Galatasaray', 'Dynamo Kyiv'
    ],

    // UEFA Europa League - 2026/27
    'UEFA Europa League': [
      'Sevilla', 'Roma', 'Bayer Leverkusen', 'Atalanta', 'Sporting CP',
      'Marseille', 'Tottenham', 'West Ham', 'Villarreal', 'Eintracht Frankfurt',
      'Real Sociedad', 'Betis', 'Olympiacos', 'Lyon', 'Rennes', 'Lille',
      'AZ Alkmaar', 'Genk', 'Midtjylland', 'Legia Warsaw'
    ],

    // UEFA Conference League - 2026/27
    'UEFA Conference League': [
      'Fiorentina', 'Osasuna', 'Hearts', 'AZ Alkmaar', 'Gent',
      'Partizan', 'Slovan Bratislava', 'Sturm Graz', 'Lugano',
      'Bodø/Glimt', 'HJK Helsinki', 'Aston Villa', 'Rapid Wien',
      'Club Brugge', 'Basel', 'Djurgårdens IF', 'Lech Poznań'
    ]
  };

  const countries = [
    'England', 'Germany', 'Netherlands', 'Spain', 'Portugal', 'France',
    'Belgium', 'Italy', 'Sweden', 'Denmark', 'Norway', 'Switzerland',
    'Austria', 'Greece', 'Turkey', 'Russia', 'Ukraine', 'Poland'
  ];

  const europeanLeagues = [
    'UEFA Champions League',
    'UEFA Europa League',
    'UEFA Conference League'
  ];

  const leaguesByCountry = {
    'England': [
      'Premier League', 'Championship', 'FA Cup', 'EFL Cup', 'Community Shield'
    ],
    'Germany': [
      'Bundesliga', '2. Bundesliga', 'DFB-Pokal', 'DFL-Supercup'
    ],
    'Netherlands': [
      'Eredivisie', 'Eerste Divisie', 'KNVB Cup', 'Johan Cruyff Shield'
    ],
    'Spain': [
      'La Liga', 'Segunda División', 'Copa del Rey', 'Supercopa de España'
    ],
    'Portugal': [
      'Liga Portugal', 'Liga Portugal 2', 'Taça de Portugal', 'Supertaça Cândido de Oliveira'
    ],
    'France': [
      'Ligue 1', 'Ligue 2', 'Coupe de France', 'Trophée des Champions'
    ],
    'Belgium': [
      'Pro League', 'Challenger Pro League', 'Belgian Cup', 'Belgian Super Cup'
    ],
    'Italy': [
      'Serie A', 'Serie B', 'Coppa Italia', 'Supercoppa Italiana'
    ],
    'Sweden': [
      'Allsvenskan', 'Superettan', 'Svenska Cupen', 'Svenska Supercupen'
    ],
    'Denmark': [
      'Danish Superliga', '1st Division', 'Danish Cup', 'Danish Super Cup'
    ],
    'Norway': [
      'Eliteserien', 'OBOS-ligaen', 'Norwegian Cup', 'Mesterfinalen'
    ],
    'Switzerland': [
      'Swiss Super League', 'Challenge League', 'Swiss Cup', 'Swiss Super Cup'
    ],
    'Austria': [
      'Austrian Bundesliga', '2. Liga', 'Austrian Cup', 'Austrian Supercup'
    ],
    'Greece': [
      'Super League Greece', 'Super League Greece 2', 'Greek Cup', 'Greek Super Cup'
    ],
    'Turkey': [
      'Süper Lig', 'TFF 1. Lig', 'Turkish Cup', 'Turkish Super Cup'
    ],
    'Russia': [
      'Russian Premier League', 'Russian First League', 'Russian Cup', 'Russian Super Cup'
    ],
    'Ukraine': [
      'Ukrainian Premier League', 'Ukrainian First League', 'Ukrainian Cup', 'Ukrainian Super Cup'
    ],
    'Poland': [
      'Ekstraklasa', 'I Liga', 'Polish Cup', 'Polish Super Cup'
    ],
    'Europa': europeanLeagues
  };

  const getLeaguesForCountry = (country) => {
    if (!country) return [];
    if (country === 'Europa') {
      return europeanLeagues;
    }
    return leaguesByCountry[country] || [];
  };

  const getTeamsForLeague = (league) => {
    if (!league) return [];
    return clubsByLeague[league] || [];
  };

  // ✅ ALL 82 BETTING MARKETS
  const allMarkets = {
    // 1. 3 WAY (1X2)
    result: { label: '3 Way (1X2)', key: 'result' },
    
    // 2. BOTH TEAMS TO SCORE
    btts: { label: 'Both Teams to Score', key: 'btts' },
    
    // 3. DOUBLE CHANCE
    doubleChance: { label: 'Double Chance', key: 'doubleChance' },
    
    // 4. OVER/UNDER
    totalGoals: { label: 'Over/Under', key: 'totalGoals' },
    
    // 5. 1ST HALF - 3 WAY
    firstHalfResult: { label: '1st Half - 3 Way', key: 'firstHalfResult' },
    
    // 6. 1ST HALF - OVER/UNDER
    firstHalfTotalGoals: { label: '1st Half - Over/Under', key: 'firstHalfTotalGoals' },
    
    // 7. 1ST HALF - CORRECT SCORE
    firstHalfCorrectScore: { label: '1st Half - Correct Score', key: 'firstHalfCorrectScore' },
    
    // 8. HALFTIME/FULLTIME
    halfTimeFullTime: { label: 'Halftime/Fulltime', key: 'halfTimeFullTime' },
    
    // 9. EXACT GOALS
    exactGoals: { label: 'Exact Goals', key: 'exactGoals' },
    
    // 10. ODD/EVEN
    oddEven: { label: 'Odd/Even', key: 'oddEven' },
    
    // 11. DRAW NO BET
    drawNoBet: { label: 'Draw No Bet', key: 'drawNoBet' },
    
    // 12. 1ST HALF - BOTH TEAMS TO SCORE
    firstHalfBtts: { label: '1st Half - Both Teams to Score', key: 'firstHalfBtts' },
    
    // 13. 3 WAY & OVER/UNDER
    threeWayOverUnder: { label: '3 Way & Over/Under', key: 'threeWayOverUnder' },
    
    // 14. 3 WAY & BOTH TEAMS TO SCORE
    threeWayBtts: { label: '3 Way & Both Teams to Score', key: 'threeWayBtts' },
    
    // 15. HOME TEAM TO WIN EITHER HALF
    homeWinEitherHalf: { label: 'Home Team to Win Either Half', key: 'homeWinEitherHalf' },
    
    // 16. AWAY TEAM TO WIN EITHER HALF
    awayWinEitherHalf: { label: 'Away Team to Win Either Half', key: 'awayWinEitherHalf' },
    
    // 17. HIGHEST SCORING HALF
    highestScoringHalf: { label: 'Highest Scoring Half', key: 'highestScoringHalf' },
    
    // 18. GOAL RANGE
    goalRange: { label: 'Goal Range', key: 'goalRange' },
    
    // 19. 1 GOAL
    oneGoal: { label: '1 Goal', key: 'oneGoal' },
    
    // 20. 1 GOAL & 1X2
    oneGoalAnd1x2: { label: '1 Goal & 1X2', key: 'oneGoalAnd1x2' },
    
    // 21. 10 MINUTES - 3 WAY FROM 1 TO 10
    tenMinute3Way: { label: '10 Minutes - 3 Way (1-10)', key: 'tenMinute3Way' },
    
    // 22. 1ST HALF - 1 GOAL
    firstHalfOneGoal: { label: '1st Half - 1 Goal', key: 'firstHalfOneGoal' },
    
    // 23. 1ST HALF - 1X2 & BOTH TEAMS TO SCORE
    firstHalf1x2Btts: { label: '1st Half - 1X2 & Both Teams to Score', key: 'firstHalf1x2Btts' },
    
    // 24. 1ST HALF - 1X2 & OVER/UNDER
    firstHalf1x2OverUnder: { label: '1st Half - 1X2 & Over/Under', key: 'firstHalf1x2OverUnder' },
    
    // 25. 1ST HALF - HOME TEAM CLEAN SHEET
    firstHalfHomeCleanSheet: { label: '1st Half - Home Team Clean Sheet', key: 'firstHalfHomeCleanSheet' },
    
    // 26. 1ST HALF - HOME TEAM OVER/UNDER
    firstHalfHomeOverUnder: { label: '1st Half - Home Team Over/Under', key: 'firstHalfHomeOverUnder' },
    
    // 27. 1ST HALF - AWAY TEAM CLEAN SHEET
    firstHalfAwayCleanSheet: { label: '1st Half - Away Team Clean Sheet', key: 'firstHalfAwayCleanSheet' },
    
    // 28. 1ST HALF - AWAY TEAM OVER/UNDER
    firstHalfAwayOverUnder: { label: '1st Half - Away Team Over/Under', key: 'firstHalfAwayOverUnder' },
    
    // 29. 1ST HALF - DOUBLE CHANCE
    firstHalfDoubleChance: { label: '1st Half - Double Chance', key: 'firstHalfDoubleChance' },
    
    // 30. 1ST HALF - DOUBLE CHANCE & BOTH TEAMS TO SCORE
    firstHalfDoubleChanceBtts: { label: '1st Half - Double Chance & Both Teams to Score', key: 'firstHalfDoubleChanceBtts' },
    
    // 31. 1ST HALF - DRAW NO BET
    firstHalfDrawNoBet: { label: '1st Half - Draw No Bet', key: 'firstHalfDrawNoBet' },
    
    // 32. 1ST HALF - EXACT GOALS
    firstHalfExactGoals: { label: '1st Half - Exact Goals', key: 'firstHalfExactGoals' },
    
    // 33. 1ST HALF - HANDICAP 1:0
    firstHalfHandicap: { label: '1st Half - Handicap 1:0', key: 'firstHalfHandicap' },
    
    // 34. 1ST HALF - ODD/EVEN
    firstHalfOddEven: { label: '1st Half - Odd/Even', key: 'firstHalfOddEven' },
    
    // 35. 1ST/2ND HALF - BOTH TEAMS TO SCORE
    bothHalvesBtts: { label: '1st/2nd Half - Both Teams to Score', key: 'bothHalvesBtts' },
    
    // 36. 2ND HALF - 1 GOAL
    secondHalfOneGoal: { label: '2nd Half - 1 Goal', key: 'secondHalfOneGoal' },
    
    // 37. 2ND HALF - 3 WAY
    secondHalfResult: { label: '2nd Half - 3 Way', key: 'secondHalfResult' },
    
    // 38. 2ND HALF - 3 WAY & BOTH TEAMS TO SCORE
    secondHalf3WayBtts: { label: '2nd Half - 3 Way & Both Teams to Score', key: 'secondHalf3WayBtts' },
    
    // 39. 2ND HALF - 3 WAY & OVER/UNDER
    secondHalf3WayOverUnder: { label: '2nd Half - 3 Way & Over/Under', key: 'secondHalf3WayOverUnder' },
    
    // 40. 2ND HALF - HOME TEAM CLEAN SHEET
    secondHalfHomeCleanSheet: { label: '2nd Half - Home Team Clean Sheet', key: 'secondHalfHomeCleanSheet' },
    
    // 41. 2ND HALF - HOME TEAM OVER/UNDER
    secondHalfHomeOverUnder: { label: '2nd Half - Home Team Over/Under', key: 'secondHalfHomeOverUnder' },
    
    // 42. 2ND HALF - BOTH TEAMS TO SCORE
    secondHalfBtts: { label: '2nd Half - Both Teams to Score', key: 'secondHalfBtts' },
    
    // 43. 2ND HALF - CORRECT SCORE
    secondHalfCorrectScore: { label: '2nd Half - Correct Score', key: 'secondHalfCorrectScore' },
    
    // 44. 2ND HALF - AWAY TEAM CLEAN SHEET
    secondHalfAwayCleanSheet: { label: '2nd Half - Away Team Clean Sheet', key: 'secondHalfAwayCleanSheet' },
    
    // 45. 2ND HALF - AWAY TEAM OVER/UNDER
    secondHalfAwayOverUnder: { label: '2nd Half - Away Team Over/Under', key: 'secondHalfAwayOverUnder' },
    
    // 46. 2ND HALF - DOUBLE CHANCE
    secondHalfDoubleChance: { label: '2nd Half - Double Chance', key: 'secondHalfDoubleChance' },
    
    // 47. 2ND HALF - DOUBLE CHANCE & BOTH TEAMS TO SCORE
    secondHalfDoubleChanceBtts: { label: '2nd Half - Double Chance & Both Teams to Score', key: 'secondHalfDoubleChanceBtts' },
    
    // 48. 2ND HALF - DRAW NO BET
    secondHalfDrawNoBet: { label: '2nd Half - Draw No Bet', key: 'secondHalfDrawNoBet' },
    
    // 49. 2ND HALF - EXACT GOALS
    secondHalfExactGoals: { label: '2nd Half - Exact Goals', key: 'secondHalfExactGoals' },
    
    // 50. 2ND HALF - HANDICAP 1:0
    secondHalfHandicap: { label: '2nd Half - Handicap 1:0', key: 'secondHalfHandicap' },
    
    // 51. 2ND HALF - ODD/EVEN
    secondHalfOddEven: { label: '2nd Half - Odd/Even', key: 'secondHalfOddEven' },
    
    // 52. 2ND HALF - OVER/UNDER
    secondHalfOverUnder: { label: '2nd Half - Over/Under', key: 'secondHalfOverUnder' },
    
    // 53. HOME TEAM CLEAN SHEET
    homeCleanSheet: { label: 'Home Team Clean Sheet', key: 'homeCleanSheet' },
    
    // 54. HOME TEAM EXACT GOALS
    homeExactGoals: { label: 'Home Team Exact Goals', key: 'homeExactGoals' },
    
    // 55. HOME TEAM HIGHEST SCORING HALF
    homeHighestScoringHalf: { label: 'Home Team Highest Scoring Half', key: 'homeHighestScoringHalf' },
    
    // 56. HOME TEAM NO BET
    homeNoBet: { label: 'Home Team No Bet', key: 'homeNoBet' },
    
    // 57. HOME TEAM ODD/EVEN
    homeOddEven: { label: 'Home Team Odd/Even', key: 'homeOddEven' },
    
    // 58. HOME TEAM OVER/UNDER
    homeOverUnder: { label: 'Home Team Over/Under', key: 'homeOverUnder' },
    
    // 59. HOME TEAM TO SCORE IN BOTH HALVES
    homeScoreBothHalves: { label: 'Home Team to Score in Both Halves', key: 'homeScoreBothHalves' },
    
    // 60. HOME TEAM TO WIN BOTH HALVES
    homeWinBothHalves: { label: 'Home Team to Win Both Halves', key: 'homeWinBothHalves' },
    
    // 61. BOTH HALVES OVER 1.5
    bothHalvesOver1_5: { label: 'Both Halves Over 1.5', key: 'bothHalvesOver1_5' },
    
    // 62. BOTH HALVES UNDER 1.5
    bothHalvesUnder1_5: { label: 'Both Halves Under 1.5', key: 'bothHalvesUnder1_5' },
    
    // 63. CORRECT SCORE
    correctScore: { label: 'Correct Score', key: 'correctScore' },
    
    // 64. AWAY TEAM CLEAN SHEET
    awayCleanSheet: { label: 'Away Team Clean Sheet', key: 'awayCleanSheet' },
    
    // 65. AWAY TEAM EXACT GOALS
    awayExactGoals: { label: 'Away Team Exact Goals', key: 'awayExactGoals' },
    
    // 66. AWAY TEAM HIGHEST SCORING HALF
    awayHighestScoringHalf: { label: 'Away Team Highest Scoring Half', key: 'awayHighestScoringHalf' },
    
    // 67. AWAY TEAM NO BET
    awayNoBet: { label: 'Away Team No Bet', key: 'awayNoBet' },
    
    // 68. AWAY TEAM ODD/EVEN
    awayOddEven: { label: 'Away Team Odd/Even', key: 'awayOddEven' },
    
    // 69. AWAY TEAM TOTAL
    awayTotal: { label: 'Away Team Total', key: 'awayTotal' },
    
    // 70. AWAY TEAM TO SCORE IN BOTH HALVES
    awayScoreBothHalves: { label: 'Away Team to Score in Both Halves', key: 'awayScoreBothHalves' },
    
    // 71. DOUBLE CHANCE (MATCH) & 1ST HALF BOTH TEAMS SCORE
    doubleChanceFirstHalfBtts: { label: 'Double Chance & 1st Half Both Teams Score', key: 'doubleChanceFirstHalfBtts' },
    
    // 72. DOUBLE CHANCE (MATCH) & 2ND HALF BOTH TEAMS SCORE
    doubleChanceSecondHalfBtts: { label: 'Double Chance & 2nd Half Both Teams Score', key: 'doubleChanceSecondHalfBtts' },
    
    // 73. DOUBLE CHANCE & BOTH TEAMS TO SCORE
    doubleChanceBtts: { label: 'Double Chance & Both Teams to Score', key: 'doubleChanceBtts' },
    
    // 74. DOUBLE CHANCE & OVER/UNDER
    doubleChanceOverUnder: { label: 'Double Chance & Over/Under', key: 'doubleChanceOverUnder' },
    
    // 75. HALFTIME/FULLTIME & 1ST HALF OVER/UNDER
    htFtFirstHalfOverUnder: { label: 'Halftime/Fulltime & 1st Half Over/Under', key: 'htFtFirstHalfOverUnder' },
    
    // 76. HALFTIME/FULLTIME & EXACT GOALS
    htFtExactGoals: { label: 'Halftime/Fulltime & Exact Goals', key: 'htFtExactGoals' },
    
    // 77. HALFTIME/FULLTIME & OVER/UNDER
    htFtOverUnder: { label: 'Halftime/Fulltime & Over/Under', key: 'htFtOverUnder' },
    
    // 78. HALFTIME/FULLTIME CORRECT SCORE
    htFtCorrectScore: { label: 'Halftime/Fulltime Correct Score', key: 'htFtCorrectScore' },
    
    // 79. HANDICAP 0:1
    handicap: { label: 'Handicap 0:1', key: 'handicap' },
    
    // 80. LAST GOAL
    lastGoal: { label: 'Last Goal', key: 'lastGoal' },
    
    // 81. OVER/UNDER & BOTH TEAMS TO SCORE
    overUnderBtts: { label: 'Over/Under & Both Teams to Score', key: 'overUnderBtts' },
    
    // 82. WHICH TEAM TO SCORE
    whichTeamToScore: { label: 'Which Team to Score', key: 'whichTeamToScore' }
  };

  const defaultOdds = {
    // Existing default odds
    doubleChance: { '1X': 1.01, '12': 1.07, 'X2': 5.45 },
    drawNoBet: { 'Home': 1.5, 'Away': 2.5 },
    btts: { 'Yes': 2.0, 'No': 1.8 },
    totalGoals: { 'Over 0.5': 1.05, 'Under 0.5': 10.0, 'Over 1.5': 1.15, 'Under 1.5': 5.25, 'Over 2.5': 1.56, 'Under 2.5': 2.43, 'Over 3.5': 1.9, 'Under 3.5': 1.9, 'Over 4.5': 3.5, 'Under 4.5': 1.3 },
    exactGoals: { '0 Goals': 8.0, '1 Goal': 4.5, '2 Goals': 3.5, '3 Goals': 4.0, '4 Goals': 7.0, '5+ Goals': 12.0 },
    correctScore: { '0-0': 8.0, '1-0': 6.0, '2-0': 8.5, '2-1': 9.0, '3-0': 15.0, '3-1': 18.0, '3-2': 25.0, '1-1': 7.0, '2-2': 12.0, '0-1': 6.5, '0-2': 9.0, '1-2': 10.0, '0-3': 20.0, 'Any Other Home Win': 30.0, 'Any Other Away Win': 35.0, 'Any Other Draw': 40.0 },
    halfTimeResult: { 'Home': 2.5, 'Draw': 2.0, 'Away': 3.0 },
    halfTimeFullTime: { 'Home/Home': 2.5, 'Home/Draw': 15.0, 'Home/Away': 30.0, 'Draw/Home': 5.0, 'Draw/Draw': 4.5, 'Draw/Away': 6.0, 'Away/Home': 25.0, 'Away/Draw': 12.0, 'Away/Away': 3.5 },
    firstTeamScore: { 'Home': 1.8, 'Away': 2.2, 'No Goal': 10.0 },
    lastTeamScore: { 'Home': 1.9, 'Away': 2.1, 'No Goal': 10.0 },
    firstGoalTime: { '0-15 Min': 3.0, '16-30 Min': 3.5, '31-45 Min': 4.0, '46-60 Min': 5.0, '61-75 Min': 6.0, '76-90 Min': 4.5, 'No Goal': 10.0 },
    teamGoalsHome: { 'Over 0.5': 1.2, 'Over 1.5': 2.0, 'Over 2.5': 4.0 },
    teamGoalsAway: { 'Over 0.5': 1.5, 'Over 1.5': 3.0, 'Over 2.5': 6.0 },
    handicap: { 'Home -1': 1.5, 'Home -2': 2.5, 'Away +1': 2.0, 'Away +2': 1.8 },
    asianHandicap: { 'Home -0.5': 1.8, 'Home -1': 2.0, 'Away +0.5': 1.9, 'Away +1': 1.7 },
    corners: { 'Over 8.5': 1.8, 'Under 8.5': 2.0, 'Home Most': 2.0, 'Away Most': 2.2, 'First Corner - Home': 1.9, 'First Corner - Away': 2.1, 'Last Corner - Home': 2.0, 'Last Corner - Away': 2.0 },
    cards: { 'Over 2.5 Yellow': 1.7, 'Under 2.5 Yellow': 2.1, 'Red Card - Yes': 3.0, 'Red Card - No': 1.3 },
    penalty: { 'Penalty Awarded': 2.5, 'No Penalty': 1.5 },
    playerMarkets: { 'Anytime Goalscorer': 2.5, 'First Goalscorer': 5.0, 'Last Goalscorer': 5.5, 'Player to Receive Card': 3.0, 'Player to Assist': 3.5 },
    specials: { 'Clean Sheet - Home': 2.0, 'Clean Sheet - Away': 2.5, 'Win to Nil - Home': 3.0, 'Win to Nil - Away': 4.0, 'Both Halves Over 1.5': 6.0, 'Highest Scoring Half - 1st': 2.0, 'Highest Scoring Half - 2nd': 2.2, 'Odd Total Goals': 1.9, 'Even Total Goals': 1.9 },

    // New markets
    firstHalfCorrectScore: { '0-0': 4.0, '1-0': 3.5, '2-0': 5.0, '2-1': 6.0, '3-0': 8.0, '3-1': 10.0, '3-2': 15.0, '1-1': 4.5, '2-2': 8.0, '0-1': 4.0, '0-2': 5.5, '1-2': 6.5, '0-3': 12.0 },
    oddEven: { 'Odd': 1.9, 'Even': 1.9 },
    firstHalfOddEven: { 'Odd': 1.9, 'Even': 1.9 },
    secondHalfOddEven: { 'Odd': 1.9, 'Even': 1.9 },
    homeOddEven: { 'Odd': 1.9, 'Even': 1.9 },
    awayOddEven: { 'Odd': 1.9, 'Even': 1.9 },
    threeWayOverUnder: { 'Home & Over 2.5': 3.5, 'Home & Under 2.5': 4.0, 'Draw & Over 2.5': 6.0, 'Draw & Under 2.5': 5.0, 'Away & Over 2.5': 4.5, 'Away & Under 2.5': 5.5 },
    threeWayBtts: { 'Home & Yes': 4.0, 'Home & No': 5.0, 'Draw & Yes': 6.0, 'Draw & No': 7.0, 'Away & Yes': 4.5, 'Away & No': 5.5 },
    homeWinEitherHalf: { 'Yes': 2.0, 'No': 1.8 },
    awayWinEitherHalf: { 'Yes': 2.2, 'No': 1.7 },
    highestScoringHalf: { '1st Half': 2.0, '2nd Half': 2.0, 'Both Equal': 3.0 },
    goalRange: { '0 Goals': 8.0, '1 Goal': 4.5, '2 Goals': 3.5, '3 Goals': 4.0, '4 Goals': 7.0, '5+ Goals': 12.0 },
    oneGoal: { '0 Goals': 8.0, '1 Goal': 4.5, '2+ Goals': 2.5 },
    oneGoalAnd1x2: { 'Home & 1 Goal': 6.0, 'Draw & 1 Goal': 8.0, 'Away & 1 Goal': 7.0 },
    tenMinute3Way: { 'Home': 4.0, 'Draw': 2.5, 'Away': 5.0 },
    firstHalfOneGoal: { '0 Goals': 3.0, '1 Goal': 2.5, '2+ Goals': 3.5 },
    firstHalf1x2Btts: { 'Home & Yes': 5.0, 'Home & No': 6.0, 'Draw & Yes': 7.0, 'Draw & No': 8.0, 'Away & Yes': 5.5, 'Away & No': 6.5 },
    firstHalf1x2OverUnder: { 'Home & Over 1.5': 4.5, 'Home & Under 1.5': 5.5, 'Draw & Over 1.5': 6.0, 'Draw & Under 1.5': 5.0, 'Away & Over 1.5': 5.0, 'Away & Under 1.5': 6.0 },
    firstHalfHomeCleanSheet: { 'Yes': 2.5, 'No': 1.5 },
    firstHalfHomeOverUnder: { 'Over 0.5': 1.8, 'Under 0.5': 2.0, 'Over 1.5': 3.0, 'Under 1.5': 1.3 },
    firstHalfAwayCleanSheet: { 'Yes': 3.0, 'No': 1.3 },
    firstHalfAwayOverUnder: { 'Over 0.5': 2.0, 'Under 0.5': 1.8, 'Over 1.5': 3.5, 'Under 1.5': 1.3 },
    firstHalfDoubleChance: { '1X': 1.5, '12': 1.8, 'X2': 2.0 },
    firstHalfDoubleChanceBtts: { '1X & Yes': 3.5, '1X & No': 4.0, '12 & Yes': 4.0, '12 & No': 4.5, 'X2 & Yes': 4.5, 'X2 & No': 5.0 },
    firstHalfDrawNoBet: { 'Home': 1.8, 'Away': 2.2 },
    firstHalfExactGoals: { '0 Goals': 3.0, '1 Goal': 2.5, '2 Goals': 4.0, '3 Goals': 7.0, '4 Goals': 12.0 },
    firstHalfHandicap: { 'Home -1': 3.0, 'Away +1': 1.5 },
    bothHalvesBtts: { 'Yes': 3.0, 'No': 1.3 },
    secondHalfOneGoal: { '0 Goals': 3.5, '1 Goal': 2.5, '2+ Goals': 3.0 },
    secondHalfResult: { 'Home': 2.5, 'Draw': 2.0, 'Away': 3.0 },
    secondHalf3WayBtts: { 'Home & Yes': 4.5, 'Home & No': 5.5, 'Draw & Yes': 6.0, 'Draw & No': 7.0, 'Away & Yes': 5.0, 'Away & No': 6.0 },
    secondHalf3WayOverUnder: { 'Home & Over 1.5': 4.0, 'Home & Under 1.5': 5.0, 'Draw & Over 1.5': 6.0, 'Draw & Under 1.5': 5.5, 'Away & Over 1.5': 4.5, 'Away & Under 1.5': 5.5 },
    secondHalfHomeCleanSheet: { 'Yes': 2.5, 'No': 1.5 },
    secondHalfHomeOverUnder: { 'Over 0.5': 1.8, 'Under 0.5': 2.0, 'Over 1.5': 3.0, 'Under 1.5': 1.3 },
    secondHalfBtts: { 'Yes': 2.5, 'No': 1.5 },
    secondHalfCorrectScore: { '0-0': 5.0, '1-0': 4.5, '2-0': 6.0, '2-1': 7.0, '1-1': 5.5, '0-1': 5.0, '0-2': 7.0, '1-2': 8.0 },
    secondHalfAwayCleanSheet: { 'Yes': 3.0, 'No': 1.3 },
    secondHalfAwayOverUnder: { 'Over 0.5': 2.0, 'Under 0.5': 1.8, 'Over 1.5': 3.5, 'Under 1.5': 1.3 },
    secondHalfDoubleChance: { '1X': 1.5, '12': 1.8, 'X2': 2.0 },
    secondHalfDoubleChanceBtts: { '1X & Yes': 3.5, '1X & No': 4.0, '12 & Yes': 4.0, '12 & No': 4.5, 'X2 & Yes': 4.5, 'X2 & No': 5.0 },
    secondHalfDrawNoBet: { 'Home': 1.8, 'Away': 2.2 },
    secondHalfExactGoals: { '0 Goals': 3.5, '1 Goal': 2.5, '2 Goals': 4.5, '3 Goals': 8.0, '4 Goals': 14.0 },
    secondHalfHandicap: { 'Home -1': 3.0, 'Away +1': 1.5 },
    secondHalfOverUnder: { 'Over 0.5': 1.5, 'Under 0.5': 2.5, 'Over 1.5': 2.5, 'Under 1.5': 1.5, 'Over 2.5': 4.5, 'Under 2.5': 1.2 },
    homeCleanSheet: { 'Yes': 2.0, 'No': 1.7 },
    homeExactGoals: { '0 Goals': 3.0, '1 Goal': 2.5, '2 Goals': 4.0, '3 Goals': 6.0, '4 Goals': 10.0 },
    homeHighestScoringHalf: { '1st Half': 2.5, '2nd Half': 2.5, 'Both Equal': 3.5 },
    homeNoBet: { 'Yes': 1.8, 'No': 2.0 },
    homeOverUnder: { 'Over 0.5': 1.5, 'Under 0.5': 2.5, 'Over 1.5': 2.5, 'Under 1.5': 1.5, 'Over 2.5': 4.5, 'Under 2.5': 1.2 },
    homeScoreBothHalves: { 'Yes': 3.0, 'No': 1.3 },
    homeWinBothHalves: { 'Yes': 4.0, 'No': 1.2 },
    bothHalvesOver1_5: { 'Yes': 3.5, 'No': 1.3 },
    bothHalvesUnder1_5: { 'Yes': 1.3, 'No': 3.5 },
    awayCleanSheet: { 'Yes': 2.5, 'No': 1.5 },
    awayExactGoals: { '0 Goals': 2.5, '1 Goal': 2.0, '2 Goals': 4.5, '3 Goals': 8.0, '4 Goals': 14.0 },
    awayHighestScoringHalf: { '1st Half': 2.5, '2nd Half': 2.5, 'Both Equal': 3.5 },
    awayNoBet: { 'Yes': 2.0, 'No': 1.8 },
    awayTotal: { 'Over 0.5': 1.8, 'Under 0.5': 2.0, 'Over 1.5': 3.5, 'Under 1.5': 1.3 },
    awayScoreBothHalves: { 'Yes': 3.5, 'No': 1.2 },
    doubleChanceFirstHalfBtts: { '1X & Yes': 4.0, '1X & No': 5.0, '12 & Yes': 4.5, '12 & No': 5.5, 'X2 & Yes': 5.0, 'X2 & No': 6.0 },
    doubleChanceSecondHalfBtts: { '1X & Yes': 4.0, '1X & No': 5.0, '12 & Yes': 4.5, '12 & No': 5.5, 'X2 & Yes': 5.0, 'X2 & No': 6.0 },
    doubleChanceBtts: { '1X & Yes': 3.5, '1X & No': 4.5, '12 & Yes': 4.0, '12 & No': 5.0, 'X2 & Yes': 4.5, 'X2 & No': 5.5 },
    doubleChanceOverUnder: { '1X & Over 2.5': 4.0, '1X & Under 2.5': 3.5, '12 & Over 2.5': 4.5, '12 & Under 2.5': 4.0, 'X2 & Over 2.5': 5.0, 'X2 & Under 2.5': 4.5 },
    htFtFirstHalfOverUnder: { 'Home/Home & Over 1.5': 6.0, 'Home/Home & Under 1.5': 7.0, 'Draw/Home & Over 1.5': 8.0, 'Draw/Home & Under 1.5': 9.0, 'Away/Away & Over 1.5': 7.0, 'Away/Away & Under 1.5': 8.0 },
    htFtExactGoals: { 'Home/Home & 1 Goal': 5.0, 'Home/Home & 2 Goals': 7.0, 'Draw/Home & 1 Goal': 6.0, 'Draw/Home & 2 Goals': 8.0, 'Away/Away & 1 Goal': 6.0, 'Away/Away & 2 Goals': 8.0 },
    htFtOverUnder: { 'Home/Home & Over 2.5': 5.5, 'Home/Home & Under 2.5': 6.5, 'Draw/Home & Over 2.5': 7.0, 'Draw/Home & Under 2.5': 8.0, 'Away/Away & Over 2.5': 6.0, 'Away/Away & Under 2.5': 7.0 },
    htFtCorrectScore: { 'Home/Home 1-0': 8.0, 'Home/Home 2-0': 12.0, 'Home/Home 2-1': 14.0, 'Draw/Home 1-0': 10.0, 'Draw/Home 2-0': 15.0, 'Away/Away 0-1': 9.0, 'Away/Away 0-2': 13.0 },
    lastGoal: { 'Home': 1.9, 'Away': 1.9, 'No Goal': 10.0 },
    overUnderBtts: { 'Over 2.5 & Yes': 3.5, 'Over 2.5 & No': 4.5, 'Under 2.5 & Yes': 4.0, 'Under 2.5 & No': 3.0 },
    whichTeamToScore: { 'Home Only': 3.0, 'Away Only': 3.5, 'Both': 2.0, 'Neither': 8.0 }
  };

  const [formData, setFormData] = useState({
    sport: 'FOOTBALL',
    country: '',
    league: '',
    homeTeam: '',
    awayTeam: '',
    date: '',
    oddsHome: '',
    oddsDraw: '',
    oddsAway: '',
    markets: {}
  });

  const availableLeagues = getLeaguesForCountry(formData.country);
  const availableTeams = getTeamsForLeague(formData.league);

  useEffect(() => {
    fetchMatches();
  }, [filters]);

  const fetchMatches = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (filters.sport) params.append('sport', filters.sport);
      if (filters.status) params.append('status', filters.status);
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.append('dateTo', filters.dateTo);

      const response = await axios.get(`${API_URL}/api/admin/matches?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMatches(response.data.matches || []);
    } catch (error) {
      console.error('Error fetching matches:', error);
      alert('Failed to fetch matches');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (matchId) => {
    if (!window.confirm('Are you sure you want to delete this match?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/api/admin/matches/${matchId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Match deleted successfully');
      fetchMatches();
    } catch (error) {
      console.error('Error deleting match:', error);
      alert('Failed to delete match');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      
      const cleanedMarkets = {};
      Object.keys(formData.markets || {}).forEach(key => {
        const marketData = formData.markets[key];
        const hasValidOdds = Object.values(marketData).some(val => val && parseFloat(val) > 0);
        if (hasValidOdds) {
          cleanedMarkets[key] = marketData;
        }
      });
      
      const data = {
        ...formData,
        odds: {
          home: parseFloat(formData.oddsHome) || 0,
          draw: parseFloat(formData.oddsDraw) || 0,
          away: parseFloat(formData.oddsAway) || 0
        },
        markets: cleanedMarkets
      };

      if (editingMatch) {
        await axios.put(`${API_URL}/api/admin/matches/${editingMatch._id}`, data, {
          headers: { Authorization: `Bearer ${token}` }
        });
        alert('Match updated successfully');
      } else {
        await axios.post(`${API_URL}/api/admin/matches`, data, {
          headers: { Authorization: `Bearer ${token}` }
        });
        alert('Match created successfully');
      }
      resetForm();
      fetchMatches();
    } catch (error) {
      console.error('Error saving match:', error);
      alert(error.response?.data?.message || 'Failed to save match');
    }
  };

  const handleMarketChange = (marketKey, optionId, value) => {
    setFormData({
      ...formData,
      markets: {
        ...formData.markets,
        [marketKey]: {
          ...(formData.markets?.[marketKey] || {}),
          [optionId]: parseFloat(value) || 0
        }
      }
    });
  };

  const handleBulkMarketAdd = (marketKey) => {
    const options = defaultOdds[marketKey] || {};
    const newMarkets = { ...formData.markets };
    newMarkets[marketKey] = options;
    
    setFormData({
      ...formData,
      markets: newMarkets
    });
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingMatch(null);
    setFormData({
      sport: 'FOOTBALL',
      country: '',
      league: '',
      homeTeam: '',
      awayTeam: '',
      date: '',
      oddsHome: '',
      oddsDraw: '',
      oddsAway: '',
      markets: {}
    });
  };

  const editMatch = (match) => {
    setEditingMatch(match);
    
    const date = new Date(match.date);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const localDateTime = `${year}-${month}-${day}T${hours}:${minutes}`;
    
    setFormData({
      sport: match.sport,
      country: match.country || '',
      league: match.league || '',
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      date: localDateTime,
      oddsHome: match.odds?.home?.toString() || '',
      oddsDraw: match.odds?.draw?.toString() || '',
      oddsAway: match.odds?.away?.toString() || '',
      markets: match.markets || {}
    });
    setShowForm(true);
  };

  // ✅ 12-HOUR TIME FORMAT WITH AM/PM
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    
    return `${year}/${month}/${day} ${hours}:${minutes} ${ampm}`;
  };

  return (
    <div className="admin-matches-page">
      <div className="admin-header">
        <h2>⚽ Match Management</h2>
        <button onClick={() => setShowForm(true)} className="btn-add">+ Add New Match</button>
      </div>

      <div className="filters-container">
        <select value={filters.sport} onChange={(e) => setFilters({ ...filters, sport: e.target.value })}>
          <option value="FOOTBALL">⚽ Football</option>
          <option value="BASKETBALL">🏀 Basketball</option>
          <option value="TENNIS">🎾 Tennis</option>
        </select>
        <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          <option value="">All Status</option>
          <option value="UPCOMING">Upcoming</option>
          <option value="LIVE">Live</option>
          <option value="FINISHED">Finished</option>
        </select>
        <input type="date" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} />
        <input type="date" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} />
        <button onClick={fetchMatches} className="btn-filter">Apply Filters</button>
      </div>

      {showForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>{editingMatch ? '✏️ Edit Match' : '➕ Add New Match'}</h3>
            <form onSubmit={handleSubmit} className="match-form">
              <div className="form-grid">
                <div className="form-group">
                  <label>Sport</label>
                  <select value={formData.sport} onChange={(e) => setFormData({ ...formData, sport: e.target.value })} required>
                    <option value="FOOTBALL">Football</option>
                    <option value="BASKETBALL">Basketball</option>
                    <option value="TENNIS">Tennis</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Country</label>
                  <select 
                    value={formData.country} 
                    onChange={(e) => {
                      setFormData({ 
                        ...formData, 
                        country: e.target.value,
                        league: '',
                        homeTeam: '',
                        awayTeam: ''
                      });
                    }} 
                    required
                  >
                    <option value="">Select a country</option>
                    <option value="Europa">🌍 Europa (UEFA Leagues)</option>
                    {countries.map((country) => (
                      <option key={country} value={country}>{country}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>League</label>
                  <select 
                    value={formData.league} 
                    onChange={(e) => {
                      setFormData({ 
                        ...formData, 
                        league: e.target.value,
                        homeTeam: '',
                        awayTeam: ''
                      });
                    }} 
                    required
                    disabled={!formData.country}
                  >
                    <option value="">
                      {formData.country ? 'Select a league' : 'Select country first'}
                    </option>
                    {availableLeagues.map((league) => (
                      <option key={league} value={league}>{league}</option>
                    ))}
                  </select>
                  {!formData.country && (
                    <small style={{ color: '#888', fontSize: '11px', display: 'block', marginTop: '4px' }}>
                      Please select a country first
                    </small>
                  )}
                </div>

                <div className="form-group">
                  <label>Home Team</label>
                  <select 
                    value={formData.homeTeam} 
                    onChange={(e) => setFormData({ ...formData, homeTeam: e.target.value })} 
                    required
                    disabled={!formData.league}
                  >
                    <option value="">
                      {formData.league ? 'Select home team' : 'Select league first'}
                    </option>
                    {availableTeams.map((team) => (
                      <option key={team} value={team}>{team}</option>
                    ))}
                  </select>
                  {!formData.league && (
                    <small style={{ color: '#888', fontSize: '11px', display: 'block', marginTop: '4px' }}>
                      Please select a league first
                    </small>
                  )}
                </div>

                <div className="form-group">
                  <label>Away Team</label>
                  <select 
                    value={formData.awayTeam} 
                    onChange={(e) => setFormData({ ...formData, awayTeam: e.target.value })} 
                    required
                    disabled={!formData.league}
                  >
                    <option value="">
                      {formData.league ? 'Select away team' : 'Select league first'}
                    </option>
                    {availableTeams.map((team) => (
                      <option key={team} value={team}>{team}</option>
                    ))}
                  </select>
                  {!formData.league && (
                    <small style={{ color: '#888', fontSize: '11px', display: 'block', marginTop: '4px' }}>
                      Please select a league first
                    </small>
                  )}
                </div>

                <div className="form-group">
                  <label>Date &amp; Time (12H)</label>
                  <input 
                    type="datetime-local" 
                    value={formData.date} 
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })} 
                    required 
                  />
                  <small style={{ color: '#888', fontSize: '11px', marginTop: '4px', display: 'block' }}>
                    Format: YYYY-MM-DD HH:MM (e.g. 2026-08-09 02:30 PM)
                  </small>
                </div>
              </div>

              <div className="odds-section">
                <h4>1X2 - Match Result</h4>
                <div className="odds-grid">
                  <div className="form-group">
                    <label>Home (1)</label>
                    <input type="number" step="0.01" min="1.01" value={formData.oddsHome} onChange={(e) => setFormData({ ...formData, oddsHome: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>Draw (X)</label>
                    <input type="number" step="0.01" min="1.01" value={formData.oddsDraw} onChange={(e) => setFormData({ ...formData, oddsDraw: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>Away (2)</label>
                    <input type="number" step="0.01" min="1.01" value={formData.oddsAway} onChange={(e) => setFormData({ ...formData, oddsAway: e.target.value })} required />
                  </div>
                </div>
              </div>

              <div className="markets-section">
                <h4>All Betting Markets</h4>
                <div className="markets-grid-admin">
                  {Object.entries(allMarkets).map(([key, market]) => (
                    <div key={key} className="market-group-admin">
                      <div className="market-header-admin">
                        <h5>{market.label}</h5>
                        <button 
                          type="button" 
                          className="btn-add-market"
                          onClick={() => handleBulkMarketAdd(key)}
                        >
                          + Add All
                        </button>
                      </div>
                      <div className="market-options-admin">
                        {formData.markets?.[key] && Object.entries(formData.markets[key]).map(([optionId, value]) => (
                          <div key={optionId} className="market-option-admin">
                            <span className="option-label-admin">{optionId}</span>
                            <input
                              type="number"
                              step="0.01"
                              min="1.01"
                              placeholder="Odds"
                              value={value || ''}
                              onChange={(e) => handleMarketChange(key, optionId, e.target.value)}
                            />
                            <button 
                              type="button" 
                              className="btn-remove-option"
                              onClick={() => {
                                const newMarkets = { ...formData.markets };
                                delete newMarkets[key][optionId];
                                if (Object.keys(newMarkets[key]).length === 0) {
                                  delete newMarkets[key];
                                }
                                setFormData({ ...formData, markets: newMarkets });
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="form-actions">
                <button type="submit" className="btn-save">{editingMatch ? 'Update' : 'Create'}</button>
                <button type="button" className="btn-cancel" onClick={resetForm}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading">Loading matches...</div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Date &amp; Time</th>
                <th>Country</th>
                <th>League</th>
                <th>Home</th>
                <th>Away</th>
                <th>1X2 Odds</th>
                <th>Markets</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {matches.map(match => (
                <tr key={match._id}>
                  <td>{formatDate(match.date)}</td>
                  <td>{match.country || 'N/A'}</td>
                  <td>{match.league}</td>
                  <td>{match.homeTeam}</td>
                  <td>{match.awayTeam}</td>
                  <td className="odds-display">{match.odds?.home || 'N/A'} / {match.odds?.draw || 'N/A'} / {match.odds?.away || 'N/A'}</td>
                  <td>
                    {match.markets && Object.keys(match.markets).length > 0 ? (
                      <span className="markets-count">{Object.keys(match.markets).length} markets</span>
                    ) : (
                      <span className="no-markets">No markets</span>
                    )}
                  </td>
                  <td><span className={`status-badge ${match.status?.toLowerCase() || 'upcoming'}`}>{match.status || 'UPCOMING'}</span></td>
                  <td className="action-buttons">
                    <button onClick={() => editMatch(match)} className="btn-edit" title="Edit">✏️</button>
                    <button onClick={() => handleDelete(match._id)} className="btn-delete" title="Delete">🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default MatchesManagement;