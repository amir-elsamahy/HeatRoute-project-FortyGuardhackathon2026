
00 — Setup & Authentication
This notebook verifies your environment is ready to talk to the FortyGuard tOS Enterprise API.

Before running: copy .env.example to .env at the repo root and paste your API key into it.

We will:

Load the API key from .env
Instantiate the Python client
Make one lightweight call (credit usage) to confirm auth works
import sys, pathlib
# Make the repo root importable regardless of where Jupyter launched from.
sys.path.insert(0, str(pathlib.Path.cwd().parent))

from dotenv import load_dotenv
load_dotenv(pathlib.Path.cwd().parent / '.env')

from fortyguard import FortyGuardClient
client = FortyGuardClient()
print('Base URL :', client.base_url)
print('API key  :', client.api_key[:6] + '…' if client.api_key else '(missing)')
# Hit the credits endpoint as a cheap auth check.
from datetime import date, timedelta

end_date   = date.today().isoformat()
start_date = (date.today() - timedelta(days=30)).isoformat()

usage = client.fetch_api_key_custom_usage(start_date=start_date, end_date=end_date)

date_range = usage.get('date_range', {})
print(f"Window      : {date_range.get('date_range_formatted') or f'{start_date} → {end_date}'}")
print(f"Credits used: {usage.get('total_credits_used')}")

for row in usage.get('activity_breakdown', []):
    print(f"  {row.get('name'):>28}: {row.get('credits')} credits over {row.get('count')} calls")
If the cell above printed your plan and remaining credits, you're ready. Continue with 01_create_heatmap.ipynb.



01 — Create Heatmap
POST /v1/heatmap generates a thermal map (GeoJSON tile layer + statistics) over a polygon AOI.

Plan: available on both Basic (≤10 mi²) and Premium (≤50 mi²).

Inputs:

polygon_aoi — GeoJSON FeatureCollection (coordinates are [lon, lat])
date_time — start_date, filter_type (1=single hour, 2=range of hours, 3=single day, 4=range of days), and matching start_time/end_time/end_date
granularity — 60, 80, or 100 meters
analytic_type — tcm (snapshot, default), time_of_measure, exceedance, or persistence (see the analysis-heatmaps section below)
Reference: filter types
The date_time payload changes shape depending on filter_type. The client builds it for you from the keyword args — pick the variant that matches the question you're asking:

filter_type	Meaning	Required keyword args	Response shape
1	Single hour	start_date, start_time	Each tile carries one temperature for that hour
2	Range of hours (same day)	start_date, start_time, end_time	Each tile carries one aggregated temperature over the range
3	Single day (daily aggregates)	start_date	Covers the full day 00:00–23:59 (any start_time is ignored). Each tile carries min_temperature, max_temperature, average_temperature (all °C). The Enterprise API does not return per-hour '00'..'23' fields.
4	Range of days (window ≤ ~31 days)	start_date, end_date	Each tile carries aggregates over the multi-day window
The use-case notebooks under notebooks/use_cases/ all call with filter_type=3 — that single call gives them both the daily peak (for ranking) and the full diurnal series (for peak-hour and swing analysis). Pick filter_type=1 only when you genuinely want one snapshot.

# filter_type=2 — average over the afternoon peak window
client.create_heatmap(polygon_aoi=AOI, start_date='2024-07-15',
                     start_time='12:00', end_time='17:00',
                     filter_type=2, granularity=100)

# filter_type=3 — full single-day capture (recommended for use cases)
client.create_heatmap(polygon_aoi=AOI, start_date='2024-07-15',
                     start_time='14:00',
                     filter_type=3, granularity=100)
Reference: granularity
Spatial resolution of the output tiles, in meters. Trade-off: smaller value → more tiles → richer detail → longer runtime and higher credit cost.

granularity	Approx. tile count for the bundled ~104 km² San Jose AOI	When to use
100	~10,000	Fast iteration / large AOIs
80	~16,500	Default for the use-case notebooks — good balance
60	~28,000	Fine-grained block-level analysis
Reference: response schema
client.create_heatmap(...) returns {"activity_id": str, "result": dict}. The result carries:

stats_data — AOI-wide aggregates (e.g. Temperature_stats, Overall_temperature_distribution).
map_data — a GeoJSON FeatureCollection. Each feature has:
geometry — a Polygon outlining the tile.
properties.tile_id — stable identifier for the tile.
properties.temperature — for filter_type=1 / 2 (single value).
properties.average_temperature / min_temperature / max_temperature — daily °C aggregates for filter_type=3 / 4 (the Enterprise API does not emit per-hour '00'..'23' fields).
All tile temperatures are °C — no conversion needed.
Units: the Enterprise API delivers tile temperatures in °C — use them directly, no conversion needed. (The Dashboard product converts to °F for display, but this API does not.)

import sys, pathlib
sys.path.insert(0, str(pathlib.Path.cwd().parent))
from dotenv import load_dotenv; load_dotenv(pathlib.Path.cwd().parent / '.env')

from fortyguard import FortyGuardClient
from fortyguard.samples import MANHATTAN_POLYGON

client = FortyGuardClient()
response = client.create_heatmap(
    polygon_aoi=MANHATTAN_POLYGON,
    start_date='2024-07-15',
    start_time='14:00',
    filter_type=1,     # single hour
    granularity=100,
)

activity_id = response['activity_id']
result = response['result']
print(f'activity_id: {activity_id}')
print(f'result keys: {list(result.keys())}')
# Look at the aggregated statistics.
stats = result.get('stats_data', {})
temp_stats = stats.get('Temperature_stats') or stats.get('temperature_stats') or {}
print('Temperature stats:')
for key, value in temp_stats.items():
    print(f'  {key:>20}: {value}')
# Plot the temperature distribution if present.
import matplotlib.pyplot as plt

dist = stats.get('Overall_temperature_distribution') or stats.get('overall_temperature_distribution')
if dist:
    plt.figure(figsize=(8, 3))
    plt.hist(dist, bins=40, color='tomato', edgecolor='white')
    plt.xlabel('Temperature (°C)'); plt.ylabel('Tile count')
    plt.title('Heatmap tile temperature distribution'); plt.tight_layout(); plt.show()
else:
    print('No distribution data returned — inspect `stats` above for alternate fields.')
# Visualise the GeoJSON tiles on a Folium map, coloured by temperature.
import folium

map_data = result.get('map_data')
if map_data and map_data.get('features'):
    temps = [f['properties'].get('temperature') for f in map_data['features'] if 'temperature' in f.get('properties', {})]
    lo, hi = (min(temps), max(temps)) if temps else (0, 1)
    
    def _style(feature):
        t = feature['properties'].get('temperature', lo)
        frac = 0 if hi == lo else (t - lo) / (hi - lo)
        r = int(255 * frac); b = int(255 * (1 - frac))
        return {'fillColor': f'#{r:02x}00{b:02x}', 'color': '#00000000', 'fillOpacity': 0.65, 'weight': 0}
    
    centroid = MANHATTAN_POLYGON['features'][0]['geometry']['coordinates'][0][0]
    fmap = folium.Map(location=[centroid[1], centroid[0]], zoom_start=14, tiles='cartodbpositron')
    folium.GeoJson(map_data, style_function=_style).add_to(fmap)
    fmap
else:
    print('No map_data features present — result shape may differ for this request.')
Analysis heatmaps (analytic_type)
The snapshot (tcm) answers "how hot is each tile?". Over a multi-hour (filter_type=2) or multi-day (filter_type=4) window, three analysis heatmaps answer richer questions from the same underlying time series — selected with the analytic_type flag:

analytic_type	Each tile shows	Units	Extra params
tcm (default)	Snapshot temperature	°C	—
time_of_measure	UTC hour-of-day (0–23) of the tile's peak	hour	—
exceedance	Count of hours the tile spends past threshold	hour	threshold (°C), direction
persistence	Longest continuous run of such hours	hour	threshold (°C), direction
direction is 'above' or 'below'. Both threshold and direction are required for exceedance and persistence, and ignored for tcm / time_of_measure.

threshold is in °C (default 30 °C on the API side) — consistent with the tcm tile temperatures, which are also returned in °C.

exceedance counts hours, not degree-hours. A value of 6.0 means the tile spent six hours past the threshold.

Response shape — different from tcm
The three analysis types return one value per tile instead of the tcm temperature fields:

map_data.features[].properties → { tile_id, value }
stats_data → { activity_id, analytic_type, units, n_cells, min, max, mean }
So the properties.temperature / '00'..'23' / min_temperature fields documented in the response schema reference above apply to tcm only. On an analysis heatmap, read properties.value and interpret it with stats_data.units.

# Exceedance heatmap: how many hours each tile spends above 35 C over a week.
exceedance = client.create_heatmap(
    polygon_aoi=MANHATTAN_POLYGON,
    start_date='2024-07-15',
    end_date='2024-07-21',
    filter_type=4,               # range of days
    analytic_type='exceedance',
    threshold=35.0,              # degrees CELSIUS (not F)
    direction='above',
    granularity=100,
)

ex_result = exceedance['result']
ex_stats = ex_result['stats_data']
print(f"activity_id : {exceedance['activity_id']}")
print(f"analytic_type: {ex_stats['analytic_type']}  |  units: {ex_stats['units']}")
print(f"cells        : {ex_stats['n_cells']}")
print(f"hours past 35 C -> min {ex_stats['min']}  mean {ex_stats['mean']:.2f}  max {ex_stats['max']}")

# Each analysis tile carries `value` (NOT `temperature`).
first = ex_result['map_data']['features'][0]['properties']
print(f"first tile   : {first}")
 
02 — Environmental Parameters
POST /v1/env_params returns thermal-comfort, air-quality, and solar-irradiance metrics for a point.

Plan: available on both tiers.

We'll request a range of hours at a point, then plot the time-series parameters returned.

About the temperature input
When you call client.environmental_parameters(...) for a (latitude, longitude), the payload requires a temperature value — the ambient air temperature at that point, in °C. The API uses it as the thermal anchor when it derives the downstream values (heat index, apparent temperature, wet-bulb, etc.), so the response is consistent with the actual conditions on the ground rather than a generic climatology.

In a real workflow you'd source this from the heatmap (see the use-case notebooks under notebooks/use_cases/ — they pass each location's peak temperature from client.create_heatmap straight into temperature=). In this demo we hard-code temperature=8.47 as the known ambient at the chosen lat/lon on 2022-06-02 00:00 — that's why that specific number appears below.

Reference: filter types
Same date_time filter types as the heatmap endpoint (which also supports filter_type=4, range of days) — the payload changes shape per filter:

filter_type	Meaning	Required keyword args	Response shape
1	Single hour	start_date, start_time	Each parameter is a single value
2	Range of hours (same day)	start_date, start_time, end_time	Each parameter is an array sized to the hour range (e.g. 16 values for 00:00→15:00)
3	Single day	start_date	Each parameter is a length-24 array covering the full day 00:00–23:59 (start_time is ignored)
4	Range of days (window ≤ ~31 days)	start_date, end_date	Each parameter is arrayed across the multi-day window
The cell below uses filter_type=2. The use-case notebooks use filter_type=3 for the full diurnal heat-index / wet-bulb / humidity curves at each top-N hotspot.

Reference: response schema
client.environmental_parameters(...) returns {"activity_id": str, "result": dict}. The result carries:

metadata
time_range: {start, end, interval, count} — ISO timestamps and the number of hourly samples in the response.
timestamps: list of ISO timestamps, one per sample.
timezone, timezone_offset_hours.
locations — list of point results. Each location has:
lat, lon, elevation (meters).
temperature — the anchor you passed in, echoed back.
parameters — the time-series dict (see below).
solar_irradiance.clear_sky — {ghi, dni, dhi} clear-sky irradiance components (W/m²).
The parameters keys returned in the bundled sample response:

Key	Description
heat_index_celsius	NOAA heat-index (apparent temp adjusted for humidity)
apparent_temperature_celsius	Australian apparent-temperature formula
wet_bulb_temperature_celsius	Wet-bulb (heat-stress threshold)
relative_humidity_percent	RH at the surface
cloud_cover_octas	Cloud cover, 0–8
precipitation_mm	Precipitation accumulation
air_quality:idx	Overall AQI index
air_quality_no2:idx, air_quality_o3:idx, air_quality_pm10:idx, air_quality_pm2p5:idx, air_quality_so2:idx	Per-pollutant AQI sub-indices
aqi_us_co	U.S. AQI for CO
co2_ppm, methane_ppb	Greenhouse gas concentrations
Each is either a scalar (filter_type=1) or a list aligned with metadata.timestamps.

Restrict the parameters (optional). The endpoint returns its full parameter set by default. Pass analysis=[...] to client.environmental_parameters(...) with a subset of the names above (e.g. analysis=['heat_index_celsius', 'wet_bulb_temperature_celsius', 'air_quality:idx']) to get just those. The client validates the names against the API's accepted set before sending.

import sys, pathlib
sys.path.insert(0, str(pathlib.Path.cwd().parent))
from dotenv import load_dotenv; load_dotenv(pathlib.Path.cwd().parent / '.env')

from fortyguard import FortyGuardClient
client = FortyGuardClient()
response = client.environmental_parameters(
    latitude=40.716452,
    longitude=-73.987041,
    temperature=8.47,
    start_date='2022-06-02',
    start_time='00:00',
    end_date='2022-06-02',
    end_time='15:00',
    filter_type=2,   # range of hours
)

result = response['result']
print('Metadata:', result.get('metadata', {}))
import pandas as pd

location = result['locations'][0]
timestamps = result['metadata'].get('timestamps', [])
params = location.get('parameters', {})

df = pd.DataFrame({k: v for k, v in params.items() if isinstance(v, list) and len(v) == len(timestamps)})
df.insert(0, 'timestamp', pd.to_datetime(timestamps))
df.set_index('timestamp', inplace=True)
df.head()
import matplotlib.pyplot as plt

to_plot = [c for c in ['heat_index_celsius', 'apparent_temperature_celsius', 'wet_bulb_temperature_celsius', 'relative_humidity_percent'] if c in df.columns]
if to_plot:
    df[to_plot].plot(figsize=(10, 4), marker='o')
    plt.title('Thermal comfort parameters over the requested window')
    plt.ylabel('value'); plt.tight_layout(); plt.show()
solar = location.get('solar_irradiance', {}).get('clear_sky', {})
print('Clear-sky solar irradiance (W/m²):')
for comp in ('ghi', 'dni', 'dhi'):
    print(f'  {comp.upper():>5}: {solar.get(comp)}')
 
03 — Satellite View Segmentation
POST /v1/satellite classifies land cover (buildings, vegetation, pavement, etc.) at a tile centred on a point.

Plan: Premium only.

Reference: filter types
The date_time payload follows the same shape as the heatmap endpoint:

filter_type	Meaning	Required keyword args
1	Single hour	start_date, start_time
2	Range of hours (same day)	start_date, start_time, end_time
3	Single day (full 24 h; start_time ignored)	start_date
4	Range of days (window ≤ ~31 days)	start_date, end_date
For satellite segmentation the per-tile composition is the same regardless of filter (surface composition doesn't change hour-to-hour), so the use-case notebooks use filter_type=3 for consistency with the heatmap call.

Reference: granularity
Same value space as the heatmap (60, 80, 100 meters). For satellite this controls the footprint of the tile centered on the requested point — higher granularity = larger ground area sampled around the point. The client defaults to 100; the use-case notebooks pass 80 explicitly for a good detail/speed balance.

Reference: response schema
client.satellite_segmentation(...) returns {"activity_id": str, "result": dict}. The result carries:

coordinates — {latitude, longitude} echoed back.
image_year — vintage of the satellite imagery (e.g. "2023").
orignal_image — list of base64-encoded original tile(s) (note: the API spelling preserves the typo orignal; original_image may also be present).
segmentation
mode — segmentation model identifier.
image_content — base64 of the segmented overlay.
image_dimensions — pixel dimensions.
image_legend — {class_name: hex_color} mapping for rendering the legend.
segments — {class_name: percent_coverage} per class.
request_id, processing_time_seconds.
Reference: land-cover class vocabulary
The classes returned by the satellite model (illustrative — classes vary by location; this notebook queries Chicago):

Class	Bucket the use-case notebooks group it into
building	impervious
road, route	impervious
sidewalk, pavement	impervious
earth, ground	impervious / bare
tree	canopy / vegetation
plant	vegetation
grass	vegetation
others	uncategorized
Note on labels. Composite classes use a ", " separator inside the key (e.g. "road, route"). The use-case notebooks bucket by keyword match ('road' in cls.lower()), which absorbs label variations without needing an exact match.

import sys, pathlib
sys.path.insert(0, str(pathlib.Path.cwd().parent))
from dotenv import load_dotenv; load_dotenv(pathlib.Path.cwd().parent / '.env')

from fortyguard import FortyGuardClient
from fortyguard.samples import CHICAGO_POINT
client = FortyGuardClient()
response = client.satellite_segmentation(
    latitude=CHICAGO_POINT['latitude'],
    longitude=CHICAGO_POINT['longitude'],
    start_date='2024-07-15',
    start_time='14:00',
    filter_type=1,
    granularity=80,
)
result = response['result']
print('Image year:', result.get('image_year'))
print('Segmentation keys:', list(result.get('segmentation', {}).keys()))
import base64, io
from PIL import Image
import matplotlib.pyplot as plt

def _decode(b64):
    if not b64: return None
    if b64.startswith('data:'):
        b64 = b64.split(',', 1)[1]
    return Image.open(io.BytesIO(base64.b64decode(b64)))

originals = result.get('orignal_image') or result.get('original_image') or []
if isinstance(originals, str):  # some responses return a single base64 string, not a list
    originals = [originals]
seg_b64 = result.get('segmentation', {}).get('image_content')

fig, axes = plt.subplots(1, 2, figsize=(10, 5))
orig = _decode(originals[0]) if originals else None
mask = _decode(seg_b64)
for ax, img, title in zip(axes, [orig, mask], ['Original satellite tile', 'Segmentation mask']):
    if img is not None:
        ax.imshow(img)
    ax.set_title(title); ax.axis('off')
plt.tight_layout(); plt.show()
# Coverage percentages per class.
segments = result.get('segmentation', {}).get('segments', {})
for cls, pct in sorted(segments.items(), key=lambda kv: kv[1], reverse=True):
    print(f'  {cls:>30}: {pct}')
 
04 — Street View Segmentation
POST /v1/streetview segments ground-level imagery (buildings, roads, vegetation, sky…) at a chosen viewing angle.

Plan: Premium only.

Reference: viewing angles and back_view
The streetview endpoint orients a virtual camera at the requested lat/lon and segments what it sees. Three controls shape the view:

Argument	Unit	Meaning
vertical_angle	degrees	Camera pitch — 0 looks straight ahead, positive values tilt the view upward (toward sky/canopy), negative values tilt downward (toward pavement)
horizontal_angle	degrees	Camera yaw — rotates the forward direction. 0 is the panorama's native forward; 90 rotates ninety degrees to one side, etc.
back_view	bool	When True, the response also includes a back block (mirror of front) facing the opposite direction. The use-case notebooks all use False; the bundled cached responses contain only the front block.
The notebooks across this quickstart use small upward pitches and either forward (0°) or sideways (90°) yaw — see what each notebook actually passes:

Notebook	vertical_angle	horizontal_angle	back_view
04_street_view_segmentation.ipynb (this one)	10.0	90.0	False
notebooks/use_cases/urban_planner_bus_stop_prioritization.ipynb	5.0	0.0	False
A small positive vertical_angle (5–10°) generally captures more of the sky and tree canopy, which is what the use-case notebooks need for shade-and-canopy analysis. Adjust the values when the goal changes — e.g. set vertical_angle slightly negative if you want to emphasize pavement coverage.

Coverage gaps. The streetview endpoint draws on ground-level panorama imagery, which is dense in U.S. urban areas but can be sparse on private property, rural roads, or recently-built developments. A request at coordinates with no nearby panorama returns an empty or error response — handle this case in production code.

Reference: response schema
client.street_view_segmentation(...) returns {"activity_id": str, "result": dict}. The result carries:

coordinates — {latitude, longitude} (as strings in the bundled samples) echoed back.
front — primary view block:
original_image — base64 of the unmodified ground-level photo.
segmented_image — base64 of the pixel-wise segmentation overlay.
segments — {class_name: percent_coverage} per class.
image_legend — {class_name: hex_color} mapping for rendering the legend.
image_date — when the underlying panorama was captured.
back — only present when back_view=True; same shape as front.
Reference: class vocabulary
The classes returned by the streetview model (illustrative — classes vary by location; this notebook queries New York):

Class	Typical use
sky	Canopy gap / openness — higher sky → more direct sun on the viewer
tree	Ground-level shade signal — distinct from tree in satellite (which is overhead)
building	Walls visible from the street; can also shade or trap heat
road, sidewalk	Surrounding paved surfaces
car	Foreground traffic
earth	Exposed ground / bare soil
others	Uncategorized pixels
The use-case notebooks group these into tree / building / sky / road buckets for the action-list scoring.

import sys, pathlib
sys.path.insert(0, str(pathlib.Path.cwd().parent))
from dotenv import load_dotenv; load_dotenv(pathlib.Path.cwd().parent / '.env')

from fortyguard import FortyGuardClient
client = FortyGuardClient()
response = client.street_view_segmentation(
    latitude=40.7128,
    longitude=-74.0060,
    vertical_angle=10.0,
    horizontal_angle=90.0,
    back_view=False,
)
result = response['result']
print('Coordinates:', result.get('coordinates'))
print('Front keys :', list(result.get('front', {}).keys()))
import base64, io
from PIL import Image
import matplotlib.pyplot as plt

def _decode(b64):
    if not b64: return None
    if b64.startswith('data:'): b64 = b64.split(',', 1)[1]
    return Image.open(io.BytesIO(base64.b64decode(b64)))

front = result.get('front', {})
fig, axes = plt.subplots(1, 2, figsize=(12, 5))
for ax, key, title in [(axes[0], 'original_image', 'Street view'), (axes[1], 'segmented_image', 'Segmentation')]:
    img = _decode(front.get(key))
    if img is not None:
        ax.imshow(img)
    ax.set_title(title); ax.axis('off')
plt.tight_layout(); plt.show()
segments = front.get('segments', {})
print('Class coverage:')
for cls, pct in sorted(segments.items(), key=lambda kv: kv[1], reverse=True):
    print(f'  {cls:>25}: {pct}')
 
05 — Heat Intelligence Report
POST /v1/heat_intelligence submits a multi-dimensional heat analysis. When the task finishes, the status endpoint streams a PDF report — the client writes it to outputs/ for you.

Plan: Premium only.

Available analysis categories: geographic, environmental, urban, events, anthropogenic.

Reference: the five analysis categories
Each value you pass in the analysis=[...] list adds a section to the generated PDF. You can request any subset — passing fewer keeps the report shorter and the credit cost lower. The keys (and what each section of the report actually covers, from the bundled sample):

Key	Section in the PDF	What it contains
geographic	Geographic Analysis	General location, terrain & elevation, proximity to water, green spaces & vegetation, land cover, building density & height, shadow coverage, urban geometry & street-canyon effects
environmental	Environmental Factors Analysis	Air quality & atmospheric opacity, climate classification & historical weather, climate trends & projections, soil moisture & permeability, heat retention of surfaces, humidity, solar radiation, nighttime cooling, thermal comfort, seasonal UHI variability
urban	Urban Factors Analysis	Urban land use characteristics, dominant land use, impervious surface fraction, heat differentials from land use, zoning & planning, land use fragmentation & thermal equity, anthropogenic heat sources
events	Events Analysis	Extreme weather & heat event history, heatwave frequency & intensity, public health impacts & heat vulnerability
anthropogenic	Anthropogenic Factors Analysis	Heat emissions from vehicles & industry, transportation heat footprint, industrial / commercial waste heat, spatial heat concentration, temporal patterns at the requested date/time, emission-reduction measures, waste-heat recovery opportunities, cooling infrastructure & the AC feedback loop, balance-point temperature, cooling inequality, district cooling systems
The bundled sample PDF (data/real_estate_san_jose_heat_intelligence_sample_day_2024-10-02_p01.pdf) was generated with all five categories enabled — open it for the full picture of what each section looks like on the page.

Reference: how the response is delivered
Unlike the other endpoints, heat_intelligence does not return JSON. The status endpoint streams a finished PDF report directly. The client detects this and writes the file to disk:

Default location: outputs/heat_intelligence_<activity_id>.pdf
Override with output_path=... to write somewhere else.
The call returns a pathlib.Path pointing at the saved file.
Because the response is a binary stream, wait=False is not supported on this method — the client always blocks until the PDF arrives.

Reference: the temperature input
Like environmental_parameters, this endpoint requires a temperature value (ambient °C) to anchor the analysis. The bundled sample uses temperature=40.74, which appears in the PDF as the "baseline temperature" referenced throughout the Events and Anthropogenic sections. Source this from a heatmap call in real workflows — see notebooks/02_environmental_parameters.ipynb for the same convention applied to the env-params endpoint.

import sys, pathlib
sys.path.insert(0, str(pathlib.Path.cwd().parent))
from dotenv import load_dotenv; load_dotenv(pathlib.Path.cwd().parent / '.env')

from fortyguard import FortyGuardClient
client = FortyGuardClient()
pdf_path = client.heat_intelligence(
    latitude=40.7128,
    longitude=-74.0060,
    temperature=32.5,
    date='2024-07-15',
    analysis=['environmental', 'urban'],
)
print(f'PDF saved to: {pdf_path.resolve()}')
# Render an inline link to the generated report.
from IPython.display import FileLink
FileLink(str(pdf_path))
 