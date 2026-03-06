/**
 * airports.js
 * Static airport database for autocomplete suggestions.
 *
 * Data format: [ICAO, Name, City, State/Country]
 * State is a 2-letter US/CA province code, or a country name for international.
 *
 * Search handles:
 *   - ICAO code exact/prefix  (KPAO, KSFO)
 *   - Short FAA code          (PAO, SFO — strips leading K)
 *   - Airport name substring  (palo alto, san francisco)
 *   - City substring          (palo alto, oakland)
 */

const Airports = (() => {

  // ── Airport data ──────────────────────────────────────────────────────────
  // [ICAO, Name, City, State]
  const RAW = [
    // ── California ─────────────────────────────────────────────────────────
    ['KSQL', 'San Carlos Airport', 'San Carlos', 'CA'],
    ['KPAO', 'Palo Alto Airport', 'Palo Alto', 'CA'],
    ['KSFO', 'San Francisco Intl', 'San Francisco', 'CA'],
    ['KOAK', 'Oakland Intl', 'Oakland', 'CA'],
    ['KSJC', 'Norman Y. Mineta San Jose Intl', 'San Jose', 'CA'],
    ['KHWD', 'Hayward Executive', 'Hayward', 'CA'],
    ['KLVK', 'Livermore Municipal', 'Livermore', 'CA'],
    ['KNUQ', 'Moffett Federal Airfield', 'Mountain View', 'CA'],
    ['KRHV', 'Reid-Hillview of Santa Clara County', 'San Jose', 'CA'],
    ['KCCR', 'Buchanan Field', 'Concord', 'CA'],
    ['KAPC', 'Napa County Airport', 'Napa', 'CA'],
    ['KSTS', 'Charles M. Schulz Sonoma County', 'Santa Rosa', 'CA'],
    ['KUKI', 'Ukiah Municipal', 'Ukiah', 'CA'],
    ['KACV', 'Arcata-Eureka Airport', 'Arcata', 'CA'],
    ['KRDD', 'Redding Municipal', 'Redding', 'CA'],
    ['KCIC', 'Chico Municipal', 'Chico', 'CA'],
    ['KSMF', 'Sacramento Intl', 'Sacramento', 'CA'],
    ['KSAC', 'Sacramento Executive', 'Sacramento', 'CA'],
    ['KAUN', 'Auburn Municipal', 'Auburn', 'CA'],
    ['KTRK', 'Truckee-Tahoe Airport', 'Truckee', 'CA'],
    ['KTVL', 'Lake Tahoe Airport', 'South Lake Tahoe', 'CA'],
    ['KMOD', 'Modesto City-County Airport', 'Modesto', 'CA'],
    ['KMCE', 'Merced Regional', 'Merced', 'CA'],
    ['KFAT', 'Fresno Yosemite Intl', 'Fresno', 'CA'],
    ['KFCH', 'Fresno Chandler Executive', 'Fresno', 'CA'],
    ['KVIS', 'Visalia Municipal', 'Visalia', 'CA'],
    ['KVTF', 'Porterville Municipal', 'Porterville', 'CA'],
    ['KBFL', 'Meadows Field', 'Bakersfield', 'CA'],
    ['KSNS', 'Salinas Municipal', 'Salinas', 'CA'],
    ['KMRY', 'Monterey Regional', 'Monterey', 'CA'],
    ['KPRB', 'Paso Robles Municipal', 'Paso Robles', 'CA'],
    ['KSBP', 'San Luis Obispo County Regional', 'San Luis Obispo', 'CA'],
    ['KIZA', 'Santa Ynez Airport', 'Santa Ynez', 'CA'],
    ['KSMX', 'Santa Maria Public Airport', 'Santa Maria', 'CA'],
    ['KSBA', 'Santa Barbara Municipal', 'Santa Barbara', 'CA'],
    ['KOXR', 'Oxnard Airport', 'Oxnard', 'CA'],
    ['KCMA', 'Camarillo Airport', 'Camarillo', 'CA'],
    ['KVNY', 'Van Nuys Airport', 'Van Nuys', 'CA'],
    ['KBUR', 'Hollywood Burbank Airport', 'Burbank', 'CA'],
    ['KLAX', 'Los Angeles Intl', 'Los Angeles', 'CA'],
    ['KSMO', 'Santa Monica Municipal', 'Santa Monica', 'CA'],
    ['KTOA', 'Torrance Municipal', 'Torrance', 'CA'],
    ['KLGB', 'Long Beach Airport', 'Long Beach', 'CA'],
    ['KSNA', 'John Wayne Orange County', 'Santa Ana', 'CA'],
    ['KFUL', 'Fullerton Municipal', 'Fullerton', 'CA'],
    ['KONT', 'Ontario Intl', 'Ontario', 'CA'],
    ['KCNO', 'Chino Airport', 'Chino', 'CA'],
    ['KPOC', 'Brackett Field', 'La Verne', 'CA'],
    ['KRAL', 'Riverside Municipal', 'Riverside', 'CA'],
    ['KPSP', 'Palm Springs Intl', 'Palm Springs', 'CA'],
    ['KTRM', 'Jacqueline Cochran Regional', 'Thermal', 'CA'],
    ['KSAN', 'San Diego Intl', 'San Diego', 'CA'],
    ['KMYF', 'Montgomery-Gibbs Executive', 'San Diego', 'CA'],
    ['KSEE', 'Gillespie Field', 'El Cajon', 'CA'],
    ['KCRQ', 'McClellan-Palomar Airport', 'Carlsbad', 'CA'],
    ['KOKB', 'Oceanside Municipal', 'Oceanside', 'CA'],
    ['KBIH', 'Eastern Sierra Regional', 'Bishop', 'CA'],
    ['KEED', 'Needles Airport', 'Needles', 'CA'],
    ['KWJF', 'General William J. Fox Airfield', 'Lancaster', 'CA'],
    ['KPMD', 'Palmdale Regional', 'Palmdale', 'CA'],
    ['KMEV', 'Minden-Tahoe Airport', 'Minden', 'NV'],

    // ── Nevada ──────────────────────────────────────────────────────────────
    ['KLAS', 'Harry Reid Intl', 'Las Vegas', 'NV'],
    ['KHND', 'Henderson Executive', 'Henderson', 'NV'],
    ['KVGT', 'North Las Vegas Airport', 'North Las Vegas', 'NV'],
    ['KRNO', 'Reno-Tahoe Intl', 'Reno', 'NV'],
    ['KRTS', 'Reno Stead Airport', 'Reno', 'NV'],
    ['KELY', 'Ely Airport', 'Ely', 'NV'],
    ['KLOL', 'Derby Field', 'Lovelock', 'NV'],

    // ── Oregon ──────────────────────────────────────────────────────────────
    ['KPDX', 'Portland Intl', 'Portland', 'OR'],
    ['KHIO', 'Portland-Hillsboro', 'Hillsboro', 'OR'],
    ['KTTD', 'Portland-Troutdale', 'Troutdale', 'OR'],
    ['KEUG', 'Mahlon Sweet Field', 'Eugene', 'OR'],
    ['KMFR', 'Rogue Valley Intl-Medford', 'Medford', 'OR'],
    ['KRBG', 'Roseburg Regional', 'Roseburg', 'OR'],
    ['KSLE', 'McNary Field', 'Salem', 'OR'],
    ['KCVO', 'Corvallis Municipal', 'Corvallis', 'OR'],
    ['KRDM', 'Roberts Field', 'Redmond', 'OR'],
    ['KBDN', 'Bend Municipal', 'Bend', 'OR'],
    ['KLKV', 'Lake County Airport', 'Lakeview', 'OR'],
    ['KAST', 'Astoria Regional', 'Astoria', 'OR'],
    ['KONP', 'Newport Municipal', 'Newport', 'OR'],

    // ── Washington ──────────────────────────────────────────────────────────
    ['KSEA', 'Seattle-Tacoma Intl', 'Seattle', 'WA'],
    ['KBFI', 'Boeing Field King County Intl', 'Seattle', 'WA'],
    ['KRNT', 'Renton Municipal', 'Renton', 'WA'],
    ['KPAE', 'Paine Field', 'Everett', 'WA'],
    ['KBLI', 'Bellingham Intl', 'Bellingham', 'WA'],
    ['KOLM', 'Olympia Regional', 'Olympia', 'WA'],
    ['KGEG', 'Spokane Intl', 'Spokane', 'WA'],
    ['KSFF', 'Felts Field', 'Spokane', 'WA'],
    ['KEAT', 'Pangborn Memorial', 'Wenatchee', 'WA'],
    ['KYKM', 'Yakima Air Terminal', 'Yakima', 'WA'],
    ['KPSC', 'Tri-Cities Airport', 'Pasco', 'WA'],
    ['KCLM', 'William R. Fairchild Intl', 'Port Angeles', 'WA'],
    ['KFHR', 'Friday Harbor Airport', 'Friday Harbor', 'WA'],
    ['KORS', 'Orcas Island Airport', 'Eastsound', 'WA'],
    ['KPWT', 'Bremerton National', 'Bremerton', 'WA'],

    // ── Idaho ───────────────────────────────────────────────────────────────
    ['KBOI', 'Boise Airport', 'Boise', 'ID'],
    ['KTWF', 'Magic Valley Regional', 'Twin Falls', 'ID'],
    ['KIDA', 'Idaho Falls Regional', 'Idaho Falls', 'ID'],
    ['KPIH', 'Pocatello Regional', 'Pocatello', 'ID'],
    ['KSUN', 'Friedman Memorial', 'Hailey', 'ID'],
    ['KSMN', 'Lemhi County Airport', 'Salmon', 'ID'],
    ['KCOE', "Coeur d'Alene Airport", "Coeur d'Alene", 'ID'],
    ['KLWS', 'Lewiston-Nez Perce County', 'Lewiston', 'ID'],
    ['KSZT', 'Sandpoint Airport', 'Sandpoint', 'ID'],

    // ── Montana ─────────────────────────────────────────────────────────────
    ['KBZN', 'Bozeman Yellowstone Intl', 'Bozeman', 'MT'],
    ['KMSO', 'Missoula Montana Airport', 'Missoula', 'MT'],
    ['KGTF', 'Great Falls Intl', 'Great Falls', 'MT'],
    ['KBIL', 'Billings Logan Intl', 'Billings', 'MT'],
    ['KHLN', 'Helena Regional', 'Helena', 'MT'],
    ['KGPI', 'Glacier Park Intl', 'Kalispell', 'MT'],

    // ── Wyoming ─────────────────────────────────────────────────────────────
    ['KJAC', 'Jackson Hole Airport', 'Jackson', 'WY'],
    ['KCPR', 'Casper-Natrona County Intl', 'Casper', 'WY'],
    ['KRKS', 'Southwest Wyoming Regional', 'Rock Springs', 'WY'],
    ['KLAR', 'Laramie Regional', 'Laramie', 'WY'],
    ['KCOD', 'Yellowstone Regional', 'Cody', 'WY'],
    ['KSHR', 'Sheridan County Airport', 'Sheridan', 'WY'],

    // ── Utah ────────────────────────────────────────────────────────────────
    ['KSLC', 'Salt Lake City Intl', 'Salt Lake City', 'UT'],
    ['KOGD', 'Ogden-Hinckley Airport', 'Ogden', 'UT'],
    ['KPVU', 'Provo Municipal', 'Provo', 'UT'],
    ['KCDC', 'Cedar City Regional', 'Cedar City', 'UT'],
    ['KSGU', 'St. George Regional', 'St. George', 'UT'],
    ['KENV', 'Wendover Airport', 'Wendover', 'UT'],

    // ── Colorado ────────────────────────────────────────────────────────────
    ['KDEN', 'Denver Intl', 'Denver', 'CO'],
    ['KAPA', 'Centennial Airport', 'Englewood', 'CO'],
    ['KBJC', 'Rocky Mountain Metropolitan', 'Broomfield', 'CO'],
    ['KFNL', 'Northern Colorado Regional', 'Fort Collins', 'CO'],
    ['KCOS', 'Colorado Springs Airport', 'Colorado Springs', 'CO'],
    ['KPUB', 'Pueblo Memorial', 'Pueblo', 'CO'],
    ['KASE', 'Aspen-Pitkin County Airport', 'Aspen', 'CO'],
    ['KEGE', 'Eagle County Regional', 'Eagle', 'CO'],
    ['KGJT', 'Grand Junction Regional', 'Grand Junction', 'CO'],
    ['KDRO', 'Durango-La Plata County', 'Durango', 'CO'],
    ['KTEX', 'Telluride Regional', 'Telluride', 'CO'],
    ['KMTJ', 'Montrose Regional', 'Montrose', 'CO'],
    ['KGUC', 'Gunnison-Crested Butte Regional', 'Gunnison', 'CO'],
    ['KHDN', 'Yampa Valley Airport', 'Hayden', 'CO'],

    // ── Arizona ─────────────────────────────────────────────────────────────
    ['KPHX', 'Phoenix Sky Harbor Intl', 'Phoenix', 'AZ'],
    ['KSDL', 'Scottsdale Airport', 'Scottsdale', 'AZ'],
    ['KDVT', 'Phoenix Deer Valley Airport', 'Phoenix', 'AZ'],
    ['KGYR', 'Phoenix Goodyear Airport', 'Goodyear', 'AZ'],
    ['KCHD', 'Chandler Municipal', 'Chandler', 'AZ'],
    ['KIWA', 'Phoenix-Mesa Gateway', 'Mesa', 'AZ'],
    ['KTUS', 'Tucson Intl', 'Tucson', 'AZ'],
    ['KRYN', 'Ryan Field', 'Tucson', 'AZ'],
    ['KAVQ', 'Marana Regional', 'Marana', 'AZ'],
    ['KFLG', 'Flagstaff Pulliam Airport', 'Flagstaff', 'AZ'],
    ['KPRC', 'Prescott Regional', 'Prescott', 'AZ'],
    ['KSEZ', 'Sedona Airport', 'Sedona', 'AZ'],
    ['KPGA', 'Page Municipal', 'Page', 'AZ'],
    ['KINW', 'Winslow-Lindbergh Regional', 'Winslow', 'AZ'],
    ['KSOW', 'Show Low Regional', 'Show Low', 'AZ'],
    ['KGCN', 'Grand Canyon National Park Airport', 'Grand Canyon', 'AZ'],
    ['KIGM', 'Kingman Airport', 'Kingman', 'AZ'],
    ['KYUM', 'Yuma Intl Airport', 'Yuma', 'AZ'],

    // ── New Mexico ──────────────────────────────────────────────────────────
    ['KABQ', 'Albuquerque Intl Sunport', 'Albuquerque', 'NM'],
    ['KAEG', 'Double Eagle II Airport', 'Albuquerque', 'NM'],
    ['KSAF', 'Santa Fe Municipal', 'Santa Fe', 'NM'],
    ['KROW', 'Roswell Intl Air Center', 'Roswell', 'NM'],
    ['KFMN', 'Four Corners Regional', 'Farmington', 'NM'],
    ['KALM', 'Alamogordo-White Sands Regional', 'Alamogordo', 'NM'],
    ['KLRU', 'Las Cruces Intl', 'Las Cruces', 'NM'],

    // ── Texas ───────────────────────────────────────────────────────────────
    ['KELP', 'El Paso Intl', 'El Paso', 'TX'],
    ['KDAL', 'Dallas Love Field', 'Dallas', 'TX'],
    ['KDFW', 'Dallas/Fort Worth Intl', 'Dallas', 'TX'],
    ['KADS', 'Addison Airport', 'Addison', 'TX'],
    ['KFTW', 'Fort Worth Meacham Intl', 'Fort Worth', 'TX'],
    ['KAFW', 'Fort Worth Alliance Airport', 'Fort Worth', 'TX'],
    ['KHOU', 'William P. Hobby Airport', 'Houston', 'TX'],
    ['KIAH', 'George Bush Intercontinental', 'Houston', 'TX'],
    ['KDWH', 'David Wayne Hooks Memorial', 'Houston', 'TX'],
    ['KSGR', 'Sugar Land Regional', 'Sugar Land', 'TX'],
    ['KAUS', 'Austin-Bergstrom Intl', 'Austin', 'TX'],
    ['KEDC', 'Austin Executive Airport', 'Austin', 'TX'],
    ['KSAT', 'San Antonio Intl', 'San Antonio', 'TX'],
    ['KBRO', 'Brownsville/South Padre Island', 'Brownsville', 'TX'],
    ['KMFE', 'McAllen Miller Intl', 'McAllen', 'TX'],
    ['KLRD', 'Laredo Intl', 'Laredo', 'TX'],
    ['KCRP', 'Corpus Christi Intl', 'Corpus Christi', 'TX'],
    ['KAMA', 'Rick Husband Amarillo Intl', 'Amarillo', 'TX'],
    ['KLBB', 'Lubbock Preston Smith Intl', 'Lubbock', 'TX'],
    ['KMAF', 'Midland Intl Air and Space Port', 'Midland', 'TX'],
    ['KACT', 'Waco Regional', 'Waco', 'TX'],
    ['KTYR', 'Tyler Pounds Regional', 'Tyler', 'TX'],
    ['KABI', 'Abilene Regional', 'Abilene', 'TX'],
    ['KSPS', 'Wichita Falls Municipal', 'Wichita Falls', 'TX'],

    // ── Oklahoma ────────────────────────────────────────────────────────────
    ['KOKC', 'Will Rogers World', 'Oklahoma City', 'OK'],
    ['KPWA', 'Wiley Post Airport', 'Oklahoma City', 'OK'],
    ['KTUL', 'Tulsa Intl', 'Tulsa', 'OK'],
    ['KRVS', 'Richard Lloyd Jones Jr Airport', 'Tulsa', 'OK'],

    // ── Kansas ──────────────────────────────────────────────────────────────
    ['KICT', 'Wichita Eisenhower National', 'Wichita', 'KS'],
    ['KTOP', 'Philip Billard Municipal', 'Topeka', 'KS'],
    ['KFOE', 'Forbes Field', 'Topeka', 'KS'],

    // ── Missouri ────────────────────────────────────────────────────────────
    ['KSTL', 'St. Louis Lambert Intl', 'St. Louis', 'MO'],
    ['KSUS', 'Spirit of St. Louis Airport', 'Chesterfield', 'MO'],
    ['KMKC', 'Charles B. Wheeler Downtown', 'Kansas City', 'MO'],
    ['KMCI', 'Kansas City Intl', 'Kansas City', 'MO'],
    ['KSGF', 'Springfield-Branson National', 'Springfield', 'MO'],

    // ── Arkansas ────────────────────────────────────────────────────────────
    ['KLIT', 'Bill and Hillary Clinton National', 'Little Rock', 'AR'],
    ['KXNA', 'Northwest Arkansas National', 'Fayetteville', 'AR'],

    // ── Louisiana ───────────────────────────────────────────────────────────
    ['KMSY', 'Louis Armstrong New Orleans Intl', 'New Orleans', 'LA'],
    ['KNEW', 'Lakefront Airport', 'New Orleans', 'LA'],
    ['KBTR', 'Baton Rouge Metropolitan', 'Baton Rouge', 'LA'],
    ['KSHV', 'Shreveport Regional', 'Shreveport', 'LA'],

    // ── Mississippi ─────────────────────────────────────────────────────────
    ['KJAN', 'Jackson-Medgar Wiley Evers Intl', 'Jackson', 'MS'],
    ['KGPT', 'Gulfport-Biloxi Intl', 'Gulfport', 'MS'],

    // ── Tennessee ───────────────────────────────────────────────────────────
    ['KBNA', 'Nashville Intl', 'Nashville', 'TN'],
    ['KJWN', 'John C. Tune Airport', 'Nashville', 'TN'],
    ['KMEM', 'Memphis Intl', 'Memphis', 'TN'],
    ['KTYS', 'McGhee Tyson Airport', 'Knoxville', 'TN'],
    ['KCHA', 'Lovell Field', 'Chattanooga', 'TN'],

    // ── Alabama ─────────────────────────────────────────────────────────────
    ['KBHM', 'Birmingham-Shuttlesworth Intl', 'Birmingham', 'AL'],
    ['KHSV', 'Huntsville Intl', 'Huntsville', 'AL'],
    ['KMGM', 'Montgomery Regional', 'Montgomery', 'AL'],
    ['KMOB', 'Mobile Regional', 'Mobile', 'AL'],

    // ── Georgia ─────────────────────────────────────────────────────────────
    ['KATL', 'Hartsfield-Jackson Atlanta Intl', 'Atlanta', 'GA'],
    ['KPDK', 'DeKalb-Peachtree Airport', 'Atlanta', 'GA'],
    ['KFTY', 'Fulton County Airport', 'Atlanta', 'GA'],
    ['KSAV', 'Savannah/Hilton Head Intl', 'Savannah', 'GA'],
    ['KCSG', 'Columbus Metropolitan', 'Columbus', 'GA'],
    ['KAHN', 'Athens-Ben Epps Airport', 'Athens', 'GA'],

    // ── Florida ─────────────────────────────────────────────────────────────
    ['KMIA', 'Miami Intl', 'Miami', 'FL'],
    ['KOPF', 'Miami-Opa Locka Executive', 'Opa Locka', 'FL'],
    ['KFLL', 'Fort Lauderdale-Hollywood Intl', 'Fort Lauderdale', 'FL'],
    ['KFXE', 'Fort Lauderdale Executive', 'Fort Lauderdale', 'FL'],
    ['KPBI', 'Palm Beach Intl', 'West Palm Beach', 'FL'],
    ['KMCO', 'Orlando Intl', 'Orlando', 'FL'],
    ['KORL', 'Orlando Executive', 'Orlando', 'FL'],
    ['KSFB', 'Orlando Sanford Intl', 'Sanford', 'FL'],
    ['KISM', 'Kissimmee Gateway', 'Kissimmee', 'FL'],
    ['KTPA', 'Tampa Intl', 'Tampa', 'FL'],
    ['KPIE', 'St. Pete-Clearwater Intl', 'Clearwater', 'FL'],
    ['KSRQ', 'Sarasota/Bradenton Intl', 'Sarasota', 'FL'],
    ['KRSW', 'Southwest Florida Intl', 'Fort Myers', 'FL'],
    ['KPGD', 'Punta Gorda Airport', 'Punta Gorda', 'FL'],
    ['KAPF', 'Naples Municipal', 'Naples', 'FL'],
    ['KEYW', 'Key West Intl', 'Key West', 'FL'],
    ['KTLH', 'Tallahassee Intl', 'Tallahassee', 'FL'],
    ['KPNS', 'Pensacola Intl', 'Pensacola', 'FL'],
    ['KDAB', 'Daytona Beach Intl', 'Daytona Beach', 'FL'],
    ['KGNV', 'Gainesville Regional', 'Gainesville', 'FL'],
    ['KJAX', 'Jacksonville Intl', 'Jacksonville', 'FL'],
    ['KCRG', 'Jacksonville Executive at Craig', 'Jacksonville', 'FL'],

    // ── South Carolina ──────────────────────────────────────────────────────
    ['KCHS', 'Charleston Intl', 'Charleston', 'SC'],
    ['KMYR', 'Myrtle Beach Intl', 'Myrtle Beach', 'SC'],
    ['KGSP', 'Greenville-Spartanburg Intl', 'Greenville', 'SC'],
    ['KCAE', 'Columbia Metropolitan', 'Columbia', 'SC'],

    // ── North Carolina ──────────────────────────────────────────────────────
    ['KCLT', 'Charlotte Douglas Intl', 'Charlotte', 'NC'],
    ['KJQF', 'Concord-Padgett Regional', 'Concord', 'NC'],
    ['KRDU', 'Raleigh-Durham Intl', 'Raleigh', 'NC'],
    ['KGSO', 'Piedmont Triad Intl', 'Greensboro', 'NC'],
    ['KAVL', 'Asheville Regional', 'Asheville', 'NC'],
    ['KILM', 'Wilmington Intl', 'Wilmington', 'NC'],

    // ── Virginia & DC ───────────────────────────────────────────────────────
    ['KIAD', 'Washington Dulles Intl', 'Washington', 'DC'],
    ['KDCA', 'Ronald Reagan Washington National', 'Washington', 'DC'],
    ['KRIC', 'Richmond Intl', 'Richmond', 'VA'],
    ['KORF', 'Norfolk Intl', 'Norfolk', 'VA'],
    ['KCHO', 'Charlottesville-Albemarle', 'Charlottesville', 'VA'],
    ['KROA', 'Roanoke-Blacksburg Regional', 'Roanoke', 'VA'],
    ['KHEF', 'Manassas Regional', 'Manassas', 'VA'],

    // ── Maryland ────────────────────────────────────────────────────────────
    ['KBWI', 'Baltimore/Washington Intl', 'Baltimore', 'MD'],
    ['KGAI', 'Montgomery County Airpark', 'Gaithersburg', 'MD'],
    ['KHGR', 'Hagerstown Regional', 'Hagerstown', 'MD'],
    ['KESN', 'Easton Airport', 'Easton', 'MD'],

    // ── Delaware ────────────────────────────────────────────────────────────
    ['KILG', 'Wilmington Airport', 'Wilmington', 'DE'],

    // ── Pennsylvania ────────────────────────────────────────────────────────
    ['KPHL', 'Philadelphia Intl', 'Philadelphia', 'PA'],
    ['KPNE', 'Northeast Philadelphia', 'Philadelphia', 'PA'],
    ['KPIT', 'Pittsburgh Intl', 'Pittsburgh', 'PA'],
    ['KAGC', 'Allegheny County Airport', 'Pittsburgh', 'PA'],
    ['KAOO', 'Johnstown-Cambria County Airport', 'Johnstown', 'PA'],
    ['KIPT', 'Williamsport Regional', 'Williamsport', 'PA'],
    ['KAVP', 'Wilkes-Barre/Scranton Intl', 'Scranton', 'PA'],
    ['KMDT', 'Harrisburg Intl', 'Harrisburg', 'PA'],
    ['KLNS', 'Lancaster Airport', 'Lancaster', 'PA'],
    ['KABE', 'Lehigh Valley Intl', 'Allentown', 'PA'],
    ['KERI', 'Erie Intl', 'Erie', 'PA'],

    // ── New Jersey ──────────────────────────────────────────────────────────
    ['KEWR', 'Newark Liberty Intl', 'Newark', 'NJ'],
    ['KTEB', 'Teterboro Airport', 'Teterboro', 'NJ'],
    ['KCDW', 'Caldwell Essex County', 'Fairfield', 'NJ'],
    ['KMMU', 'Morristown Municipal', 'Morristown', 'NJ'],
    ['KACY', 'Atlantic City Intl', 'Atlantic City', 'NJ'],

    // ── New York ────────────────────────────────────────────────────────────
    ['KJFK', 'John F. Kennedy Intl', 'New York', 'NY'],
    ['KLGA', 'LaGuardia Airport', 'New York', 'NY'],
    ['KHPN', 'Westchester County Airport', 'White Plains', 'NY'],
    ['KFRG', 'Republic Airport', 'Farmingdale', 'NY'],
    ['KISP', 'Long Island MacArthur', 'Ronkonkoma', 'NY'],
    ['KBUF', 'Buffalo Niagara Intl', 'Buffalo', 'NY'],
    ['KROC', 'Greater Rochester Intl', 'Rochester', 'NY'],
    ['KSYR', 'Syracuse Hancock Intl', 'Syracuse', 'NY'],
    ['KALB', 'Albany Intl', 'Albany', 'NY'],
    ['KPOU', 'Dutchess County Airport', 'Poughkeepsie', 'NY'],
    ['KSWF', 'New York Stewart Intl', 'Newburgh', 'NY'],
    ['KHTO', 'East Hampton Airport', 'East Hampton', 'NY'],
    ['KFOK', 'Francis S. Gabreski Airport', 'Westhampton Beach', 'NY'],

    // ── Connecticut ─────────────────────────────────────────────────────────
    ['KBDL', 'Bradley Intl', 'Windsor Locks', 'CT'],
    ['KHVN', 'Tweed-New Haven', 'New Haven', 'CT'],
    ['KGON', 'Groton-New London Airport', 'Groton', 'CT'],
    ['KDXR', 'Danbury Municipal', 'Danbury', 'CT'],
    ['KHFD', 'Hartford-Brainard Airport', 'Hartford', 'CT'],
    ['KOXC', 'Waterbury-Oxford Airport', 'Oxford', 'CT'],

    // ── Massachusetts ───────────────────────────────────────────────────────
    ['KBOS', 'Boston Logan Intl', 'Boston', 'MA'],
    ['KBED', 'Hanscom Field', 'Bedford', 'MA'],
    ['KOWD', 'Norwood Memorial', 'Norwood', 'MA'],
    ['KBVY', 'Beverly Municipal', 'Beverly', 'MA'],
    ['KORH', 'Worcester Regional', 'Worcester', 'MA'],
    ['KACK', 'Nantucket Memorial', 'Nantucket', 'MA'],
    ['KMVW', "Martha's Vineyard Airport", 'Vineyard Haven', 'MA'],
    ['KHYA', 'Barnstable Municipal', 'Hyannis', 'MA'],

    // ── Rhode Island ────────────────────────────────────────────────────────
    ['KPVD', 'T.F. Green Providence', 'Providence', 'RI'],

    // ── Vermont ─────────────────────────────────────────────────────────────
    ['KBTV', 'Burlington Intl', 'Burlington', 'VT'],
    ['KRUT', 'Rutland-Southern Vermont Regional', 'Rutland', 'VT'],

    // ── New Hampshire ───────────────────────────────────────────────────────
    ['KMHT', 'Manchester-Boston Regional', 'Manchester', 'NH'],
    ['KASH', 'Boire Field', 'Nashua', 'NH'],
    ['KCON', 'Concord Municipal', 'Concord', 'NH'],

    // ── Maine ───────────────────────────────────────────────────────────────
    ['KBGR', 'Bangor Intl', 'Bangor', 'ME'],
    ['KPWM', 'Portland Intl Jetport', 'Portland', 'ME'],
    ['KRKD', 'Knox County Regional', 'Rockland', 'ME'],
    ['KBHB', 'Hancock County-Bar Harbor', 'Bar Harbor', 'ME'],

    // ── Michigan ────────────────────────────────────────────────────────────
    ['KDTW', 'Detroit Metropolitan Wayne County', 'Detroit', 'MI'],
    ['KDET', 'Coleman A. Young Intl', 'Detroit', 'MI'],
    ['KPTK', 'Oakland County Intl', 'Pontiac', 'MI'],
    ['KGRR', 'Gerald R. Ford Intl', 'Grand Rapids', 'MI'],
    ['KLAN', 'Capital Region Intl', 'Lansing', 'MI'],
    ['KTVC', 'Cherry Capital Airport', 'Traverse City', 'MI'],
    ['KFNT', 'Bishop Intl', 'Flint', 'MI'],
    ['KAZO', 'Kalamazoo-Battle Creek Intl', 'Kalamazoo', 'MI'],
    ['KMKG', 'Muskegon County Airport', 'Muskegon', 'MI'],
    ['KSAW', 'Sawyer Intl', 'Gwinn', 'MI'],
    ['KESC', 'Delta County Airport', 'Escanaba', 'MI'],

    // ── Ohio ────────────────────────────────────────────────────────────────
    ['KCLE', 'Cleveland Hopkins Intl', 'Cleveland', 'OH'],
    ['KBKL', 'Burke Lakefront', 'Cleveland', 'OH'],
    ['KCMH', 'John Glenn Columbus Intl', 'Columbus', 'OH'],
    ['KOSU', 'Ohio State University Airport', 'Columbus', 'OH'],
    ['KDAY', 'Dayton Intl', 'Dayton', 'OH'],
    ['KTOL', 'Toledo Express', 'Toledo', 'OH'],
    ['KCAK', 'Akron-Canton Regional', 'Akron', 'OH'],
    ['KYNG', 'Youngstown-Warren Regional', 'Vienna', 'OH'],

    // ── Indiana ─────────────────────────────────────────────────────────────
    ['KIND', 'Indianapolis Intl', 'Indianapolis', 'IN'],
    ['KEVV', 'Evansville Regional', 'Evansville', 'IN'],
    ['KSBN', 'South Bend Intl', 'South Bend', 'IN'],
    ['KFWA', 'Fort Wayne Intl', 'Fort Wayne', 'IN'],

    // ── Illinois ────────────────────────────────────────────────────────────
    ["KORD", "O'Hare Intl", 'Chicago', 'IL'],
    ['KMDW', 'Chicago Midway Intl', 'Chicago', 'IL'],
    ['KDPA', 'DuPage Airport', 'West Chicago', 'IL'],
    ['KPWK', 'Chicago Executive', 'Wheeling', 'IL'],
    ['KMLI', 'Quad City Intl', 'Moline', 'IL'],
    ['KCMI', 'University of Illinois Willard', 'Savoy', 'IL'],
    ['KSPI', 'Abraham Lincoln Capital', 'Springfield', 'IL'],
    ['KPIA', 'General Downing Peoria Intl', 'Peoria', 'IL'],

    // ── Wisconsin ───────────────────────────────────────────────────────────
    ['KMKE', 'Milwaukee Mitchell Intl', 'Milwaukee', 'WI'],
    ['KATW', 'Outagamie County Regional', 'Appleton', 'WI'],
    ['KGRB', 'Green Bay Austin Straubel Intl', 'Green Bay', 'WI'],
    ['KMSN', 'Dane County Regional', 'Madison', 'WI'],
    ['KEAU', 'Chippewa Valley Regional', 'Eau Claire', 'WI'],

    // ── Minnesota ───────────────────────────────────────────────────────────
    ['KMSP', 'Minneapolis-Saint Paul Intl', 'Minneapolis', 'MN'],
    ['KSTP', 'St. Paul Downtown Holman Field', 'St. Paul', 'MN'],
    ['KFCM', 'Flying Cloud Airport', 'Eden Prairie', 'MN'],
    ['KDLH', 'Duluth Intl', 'Duluth', 'MN'],

    // ── Iowa ────────────────────────────────────────────────────────────────
    ['KDSM', 'Des Moines Intl', 'Des Moines', 'IA'],
    ['KCID', 'The Eastern Iowa Airport', 'Cedar Rapids', 'IA'],
    ['KSUX', 'Sioux Gateway Airport', 'Sioux City', 'IA'],

    // ── Nebraska ────────────────────────────────────────────────────────────
    ['KOMA', 'Eppley Airfield', 'Omaha', 'NE'],
    ['KLNK', 'Lincoln Airport', 'Lincoln', 'NE'],

    // ── South Dakota ────────────────────────────────────────────────────────
    ['KFSD', 'Sioux Falls Regional', 'Sioux Falls', 'SD'],
    ['KRAP', 'Rapid City Regional', 'Rapid City', 'SD'],

    // ── North Dakota ────────────────────────────────────────────────────────
    ['KBIS', 'Bismarck Municipal', 'Bismarck', 'ND'],
    ['KFAR', 'Hector Intl', 'Fargo', 'ND'],
    ['KGFK', 'Grand Forks Intl', 'Grand Forks', 'ND'],

    // ── Hawaii ──────────────────────────────────────────────────────────────
    ['PHNL', 'Daniel K. Inouye Intl', 'Honolulu', 'HI'],
    ['PHJR', 'Kalaeloa Airport', 'Kapolei', 'HI'],
    ['PHOG', 'Kahului Airport', 'Kahului', 'HI'],
    ['PHKO', 'Ellison Onizuka Kona Intl', 'Kailua-Kona', 'HI'],
    ['PHLI', 'Lihue Airport', 'Lihue', 'HI'],
    ['PHTO', 'Hilo Intl', 'Hilo', 'HI'],
    ['PHNY', 'Lanai Airport', 'Lanai City', 'HI'],
    ['PHMK', 'Molokai Airport', 'Kaunakakai', 'HI'],

    // ── Alaska ──────────────────────────────────────────────────────────────
    ['PANC', 'Ted Stevens Anchorage Intl', 'Anchorage', 'AK'],
    ['PAFA', 'Fairbanks Intl', 'Fairbanks', 'AK'],
    ['PAJN', 'Juneau Intl', 'Juneau', 'AK'],
    ['PAKT', 'Ketchikan Intl', 'Ketchikan', 'AK'],
    ['PASN', 'Sitka Rocky Gutierrez', 'Sitka', 'AK'],
    ['PADQ', 'Kodiak Airport', 'Kodiak', 'AK'],
    ['PAOM', 'Nome Airport', 'Nome', 'AK'],

    // ── Mexico ──────────────────────────────────────────────────────────────
    ['MMTJ', 'Tijuana Intl', 'Tijuana', 'Mexico'],
    ['MMSD', 'Los Cabos Intl', 'San José del Cabo', 'Mexico'],
    ['MMMX', 'Mexico City Intl', 'Mexico City', 'Mexico'],
    ['MMGL', 'Guadalajara Intl', 'Guadalajara', 'Mexico'],
    ['MMUN', 'Cancún Intl', 'Cancún', 'Mexico'],
    ['MMPR', 'Puerto Vallarta Intl', 'Puerto Vallarta', 'Mexico'],
    ['MMMZ', 'Mazatlán Intl', 'Mazatlán', 'Mexico'],
    ['MMLO', 'Del Bajío Intl', 'Silao', 'Mexico'],
    ['MMCY', 'Culiacán Intl', 'Culiacán', 'Mexico'],
    ['MMSP', 'San Luis Potosí Intl', 'San Luis Potosí', 'Mexico'],
    ['MMPN', 'Morelia Intl', 'Morelia', 'Mexico'],
    ['MMHO', 'General Ignacio Pesqueira García Intl', 'Hermosillo', 'Mexico'],
    ['MMCT', 'Chetumal Intl', 'Chetumal', 'Mexico'],
    ['MMAS', 'Jesús Terán Peredo Intl', 'Aguascalientes', 'Mexico'],

    // ── Canada ───────────────────────────────────────────────────────────────
    ['CYVR', 'Vancouver Intl', 'Vancouver', 'BC'],
    ['CYYC', 'Calgary Intl', 'Calgary', 'AB'],
    ['CYEG', 'Edmonton Intl', 'Edmonton', 'AB'],
    ['CYWG', 'James Armstrong Richardson Intl', 'Winnipeg', 'MB'],
    ['CYYZ', 'Toronto Pearson Intl', 'Toronto', 'ON'],
    ['CYUL', 'Montréal-Trudeau Intl', 'Montreal', 'QC'],
    ['CYHZ', 'Halifax Stanfield Intl', 'Halifax', 'NS'],
    ['CYOW', 'Ottawa Macdonald-Cartier Intl', 'Ottawa', 'ON'],

    // ── Caribbean / Puerto Rico ──────────────────────────────────────────────
    ['TJSJ', 'Luis Muñoz Marín Intl', 'San Juan', 'PR'],
    ['TJBQ', 'Rafael Hernández Airport', 'Aguadilla', 'PR'],
    ['MYNN', 'Lynden Pindling Intl', 'Nassau', 'Bahamas'],
    ['MYAF', 'Grand Bahama Intl', 'Freeport', 'Bahamas'],
    ['MKJP', 'Norman Manley Intl', 'Kingston', 'Jamaica'],
    ['MDSD', 'Las Américas Intl', 'Santo Domingo', 'Dominican Republic'],
  ];

  // ── Build ICAO lookup map ─────────────────────────────────────────────────
  const byIcao = Object.create(null);
  RAW.forEach(([icao, name, city, state]) => {
    byIcao[icao] = { icao, name, city, state };
  });

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Look up an airport by its code.
   * Handles both KPAO and PAO (strips leading K for US airports).
   * Returns { icao, name, city, state } or null.
   */
  function lookup(code) {
    if (!code) return null;
    const c = code.toUpperCase().trim();
    return byIcao[c] || byIcao['K' + c] || null;
  }

  /**
   * Canonicalize user input: PAO → KPAO, KPAO → KPAO, SFO → KSFO.
   * If the input is already a valid 4-letter ICAO, return as-is.
   * If it's 3 letters and prepending K makes a known airport, return that.
   * Otherwise return the uppercased input unchanged.
   */
  function canonicalize(raw) {
    if (!raw) return '';
    const up = raw.toUpperCase().trim();
    if (byIcao[up]) return up;
    const withK = 'K' + up;
    if (byIcao[withK]) return withK;
    return up;
  }

  /**
   * Search for airports matching query.
   * Returns array of { icao, name, city, state, label, title, score } sorted by relevance.
   * @param {string} query
   * @param {number} [limit=8]
   */
  function search(query, limit = 8) {
    if (!query || query.trim().length < 2) return [];
    const q = query.trim().toLowerCase();

    const results = [];

    for (let i = 0; i < RAW.length; i++) {
      const [icao, name, city, state] = RAW[i];
      const icaoL  = icao.toLowerCase();
      const nameL  = name.toLowerCase();
      const cityL  = city.toLowerCase();
      const stateL = state.toLowerCase();
      // Short code: strip leading K for K-prefix airports
      const shortL = (icao.length === 4 && icao[0] === 'K') ? icao.slice(1).toLowerCase() : '';

      let score = 0;

      if (icaoL === q)                 score = 100;
      else if (shortL && shortL === q) score = 95;
      else if (icaoL.startsWith(q))    score = 80;
      else if (shortL && shortL.startsWith(q)) score = 75;
      else if (nameL.startsWith(q))    score = 70;
      else if (cityL.startsWith(q))    score = 65;
      else if (nameL.includes(q))      score = 50;
      else if (cityL.includes(q))      score = 45;
      else continue; // no match

      results.push({
        icao, name, city, state, score,
        label: `${icao} — ${name} · ${city}, ${state}`,
        title: `${name}, ${city}, ${state}`,
      });
    }

    return results
      .sort((a, b) => b.score - a.score || a.icao.localeCompare(b.icao))
      .slice(0, limit);
  }

  return { lookup, search, canonicalize };
})();
