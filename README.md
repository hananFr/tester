# מדריך לבודק

הקובץ `index.js` הוא סקריפט בדיקה אוטומטי למבחן FastAPI של מחסן הנשק.  
הוא מריץ בקשות מול שרת FastAPI שרץ מקומית על `http://localhost:8000`, סורק את קוד ה־Python של התלמיד, בודק את האנדפוינטים, ומייצר קובץ ציון.

## לפני הרצה

1. ודא שהגשת התלמיד כוללת שרת FastAPI תקין.
2. ודא שהשרת משתמש בקובץ `weapons.json` כבסיס נתונים.
3. הפעל את שרת התלמיד על פורט `8000`.

דוגמה להרצת שרת:

```bash
uvicorn main:app --reload
```

אם קובץ השרת של התלמיד לא נקרא `main.py`, יש להתאים את הפקודה לשם הקובץ והאובייקט `app`.

אם רוצים שגם הבודק יבדוק פלט לוגים שנכתב בזמן הריצה, מומלץ להריץ את השרת עם הפניה לקובץ:

```bash
uvicorn main:app --reload > server.log 2>&1
```

ואז להריץ את הבודק עם:

```bash
SERVER_LOG_FILE=server.log node index.js
```

הבדיקה הזו לא מחליפה את סריקת הקוד. כדי לקבל ניקוד על logger עדיין צריך שימוש ב־`logging` בקוד Python, אבל קובץ הלוג עוזר לזהות מקרים שבהם הלוגים באמת נכתבים בזמן בקשות.

## מאיפה מריצים

הדרך המומלצת: להעתיק את `index.js`, `package.json`, `weapons.json` ו־`weapons.source.json` לתיקיית הפרויקט של התלמיד, ואז להריץ משם:

```bash
node index.js
```

במצב הזה הסקריפט:

- קורא את `weapons.json` מתוך תיקיית הפרויקט.
- מאפס בתחילת כל ריצה את `weapons.json` לפי `weapons.source.json`.
- מאפס שוב את `weapons.json` לפני כל בדיקת אנדפוינט, כדי שכל בדיקה תתחיל מול דאטה נקי.
- סורק את קבצי ה־`.py` של התלמיד באותה תיקייה.
- שומר את התוצאה גם ב־`grades.json` וגם בקובץ מצטבר תחת `grades/`.

אפשרות נוספת: להשאיר את הסקריפט בתיקיית הבודק ולהעביר לו את נתיב הפרויקט של התלמיד:

```bash
STUDENT_PROJECT_DIR=/path/to/student/project node index.js
```

במצב הזה הסקריפט יקרא את `weapons.json` ויסרוק את קבצי ה־Python מתוך `STUDENT_PROJECT_DIR`, אבל עדיין ישמור את קבצי הציונים בתיקייה שממנה נמצא `index.js`.

אם קובץ המקור נמצא במקום אחר, אפשר להעביר גם אותו:

```bash
STUDENT_PROJECT_DIR=/path/to/student/project WEAPONS_SOURCE_FILE=/path/to/weapons.source.json node index.js
```

אפשר לשלב גם קובץ לוג:

```bash
STUDENT_PROJECT_DIR=/path/to/student/project SERVER_LOG_FILE=/path/to/student/project/server.log node index.js
```

חשוב: שרת התלמיד חייב להשתמש באותו `weapons.json` שהסקריפט קורא ממנו. לכן הכי פשוט ובטוח להריץ את הסקריפט מתוך תיקיית הפרויקט של התלמיד.

## הרצה ב־Windows

הסקריפט עצמו מתאים גם ל־Windows, כל עוד מותקן Node.js בגרסה 18 ומעלה. הקוד משתמש ב־`path.join` ו־`path.resolve`, ולכן נתיבים של Windows כמו `C:\Users\...\project` אמורים לעבוד.

ההבדל העיקרי הוא צורת הגדרת משתני הסביבה. במקום:

```bash
STUDENT_PROJECT_DIR=/path/to/student/project node index.js
```

ב־PowerShell משתמשים כך:

```powershell
$env:STUDENT_PROJECT_DIR="C:\path\to\student\project"
node index.js
```

אפשר להוסיף גם קובץ מקור וקובץ לוג:

```powershell
$env:STUDENT_PROJECT_DIR="C:\path\to\student\project"
$env:WEAPONS_SOURCE_FILE="C:\path\to\weapons.source.json"
$env:SERVER_LOG_FILE="C:\path\to\student\project\server.log"
node index.js
```

ב־cmd משתמשים כך:

```cmd
set STUDENT_PROJECT_DIR=C:\path\to\student\project
node index.js
```

הפניית לוגים ב־Windows עובדת גם כן:

```cmd
uvicorn main:app --reload > server.log 2>&1
```

## איפוס נתונים

הבדיקות משנות את `weapons.json`: הן מוסיפות, מעדכנות ומוחקות פריטים.  
כדי שכל תלמיד וכל ריצה יתחילו מאותו מצב, הסקריפט מאפס בתחילת הריצה את `weapons.json` מתוך `weapons.source.json`.

כלומר:

```text
weapons.source.json -> נדרס לתוך -> weapons.json
```

אין לערוך את `weapons.source.json` במהלך בדיקה רגילה. אם רוצים לשנות את הדאטה ההתחלתי של המבחן, משנים את `weapons.source.json`, ואז כל ריצה תתחיל מהדאטה החדש.

## הרצת הבדיקה

הסקריפט יבקש שם תלמיד:

```text
Student Name
```

לאחר הכנסת השם, הסקריפט יריץ את כל הבדיקות וישמור את התוצאה.

## מבנה הציון

הציון מחולק לפי טבלת הניקוד שמופיעה בהערה בראש `index.js`:

| אנדפוינט | ניקוד |
|---|---:|
| `GET /weapons` | 9 |
| `GET /weapons/{id}` | 9 |
| `POST /weapons` | 9 |
| `PUT /weapons/{id}` | 9 |
| `DELETE /weapons/{id}` | 9 |
| `GET /weapons/by-condition?condition=` | 9 |
| `GET /weapons/combat-ready?type=` | 9 |
| `GET /weapons/summary/by-type` | 9 |
| `DELETE /weapons/by-condition?condition=` | 8 |

סה"כ בדיקת אנדפוינטים: `80` נקודות.

ניקוד הבסיס של כל אנדפוינט ניתן על קלט תקין. בנוסף, מקרי קלט לא תקין שקשורים לאותו אנדפוינט יכולים להוריד נקודה מהאנדפוינט אם השרת מקבל אותם כאילו הם תקינים. ולידציה כזו אינה חלק מניקוד איכות הקוד.

שימוש ב־`HTTPException` נבדק כסעיף איכות קוד גלובלי של `5` נקודות בתוך הניקוד האוטומטי הנוסף.

גם עבודה מול קובץ JSON נבדקת כסעיף גלובלי של `5` נקודות. בדיקות האנדפוינטים עצמן לא מפילות את כל ניקוד האנדפוינט רק בגלל שהשרת מחזיק נתונים בזיכרון ולא קרא מחדש את הקובץ אחרי איפוס של הבודק.

## ניקוד אוטומטי נוסף

מעבר ל־`80` נקודות האנדפוינטים, הסקריפט מחשב עוד `20` נקודות אוטומטית:

| סעיף | ניקוד |
|---|---:|
| השרת כתוב ב־FastAPI ועולה ללא קריסה | 5 |
| הנתונים נקראים ונשמרים מקובץ `weapons.json`, ולא מוחזקים כנתונים קשיחים בקוד | 5 |
| שימוש ב־logger לתיעוד פעולות ושגיאות | 5 |
| שימוש ב־HTTPException לטיפול בשגיאות, ולא החזרת `return {"error": "..."}` | 5 |

הציון הסופי הוא:

```text
ציון סופי = endpoint_points + code_quality_points
```

מקסימום: `100` נקודות.

שימו לב: ארבעת הסעיפים האלה נבדקים באמצעות שילוב של בדיקת שרת וסריקה סטטית של קבצי Python. אם התלמיד השתמש במימוש מאוד חריג, כדאי לבודק לעבור על הקוד במקרה של ספק.

## מה הבודק בודק בפועל

הסקריפט בודק:

- החזרת כל כלי הנשק מ־`weapons.json`.
- החזרת פריט לפי `id`.
- הוספת פריט חדש עם `id` שנוצר בשרת לפי `max id + 1`. בדיקת ה־POST יוצרת בכוונה פער ב־IDs לפני ההוספה, כדי לוודא שהתלמיד לא משתמש בטעות ב־`len(data) + 1`.
- עדכון פריט קיים בלי ליצור פריט חדש. הבודק מקבל גם מימוש של עדכון מלא וגם מימוש של עדכון חלקי, כל עוד הפריט הנכון מתעדכן והמידע נשמר ב־`weapons.json`.
- מחיקת פריט קיים בלבד.
- סינון לפי `condition`.
- סינון כלי נשק מוכנים ללחימה לפי `type` ו־`condition` שהוא `new` או `good`.
- חישוב דינמי של כמות פריטים לפי `type`.
- מחיקת כל הפריטים לפי `condition`.
- שהפעולות שמשנות מידע באמת מעדכנות את קובץ ה־JSON, ולא רק משתנה בזיכרון.

הערה על מחיקה: `DELETE /weapons/{id}` נבדק על פריט שכבר קיים ב־`weapons.json` לאחר האיפוס. לכן גם אם `POST /weapons` לא עובד, עדיין אפשר לקבל ניקוד על מחיקה לפי מזהה.

הבודק מניח שקובץ `weapons.json` תקין. אין בדיקה לניהול שגיאות של קובץ JSON פגום או חסר.

## פלט

בסיום כל ריצה נוצרים כמה קבצי פלט:

- `grades.json` - הריצה האחרונה בלבד, לנוחות צפייה מהירה.
- `grades/<student-name>.json` - קובץ JSON לתלמיד.
- `grades/<student-name>.md` - דוח קריא לתלמיד: למעלה סיכום בסיסי, למטה פירוט כשלים.
- `grades/summary.md` - טבלת סיכום מצטברת של כל התלמידים לפי סעיף.

כך אפשר לבדוק תלמידים אחד אחרי השני באותה תיקייה. אם מריצים שוב עם אותו שם תלמיד, הקובץ הקודם של אותו תלמיד נדרס כדי שבסיכום תופיע רק התוצאה העדכנית שלו.

בנוסף לניקוד הקלט התקין, הבודק מריץ מקרי ולידציה רק עבור בקשות עם `body`. אלו תרחישי שימוש שגויים של אנדפוינט, ולכן כל מקרה שנכשל מוריד נקודה מהאנדפוינט הרלוונטי ולא מסעיפי איכות הקוד:

- `POST /weapons` עם שדה חובה חסר צריך להחזיר שגיאה, אחרת יורדת נקודה מ־`POST /weapons`.
- `POST /weapons` עם שדה לא מותר: תקין אם השרת מחזיר שגיאה, וגם תקין אם השרת מתעלם מהשדה ולא שומר אותו. אם השדה נשמר, יורדת נקודה מ־`POST /weapons`.

דוגמה:

```json
{
  "name": "Student Name",
  "endpoint_points": 80,
  "code_quality_points": 20,
  "code_requirements": {
    "fastapi_server_runs": 5,
    "json_file_database": 5,
    "logger_usage": 5,
    "http_exception_usage": 5
  },
  "project_dir": "/path/to/student/project",
  "weapons_file": "/path/to/student/project/weapons.json",
  "source_weapons_file": "/path/to/checker/weapons.source.json",
  "grades_file": "/path/to/checker/grades/student-name.json",
  "report_file": "/path/to/checker/grades/student-name.md",
  "latest_grades_file": "/path/to/checker/grades.json",
  "summary_file": "/path/to/checker/grades/summary.md",
  "/weapons": 9,
  "/weapons/{id}": 9,
  "POST /weapons": 9,
  "PUT /weapons/{id}": 9,
  "DELETE /weapons/{id}": 9,
  "/weapons/by-condition": 9,
  "/weapons/combat-ready": 9,
  "/weapons/summary/by-type": 9,
  "DELETE /weapons/by-condition": 8,
  "failures": [],
  "total": 100,
  "max_score": 100
}
```

אם בדיקה נכשלת, יופיעו פרטים בתוך `failures`. כל כשל כולל את שם האנדפוינט או סעיף הקוד, שם הבדיקה, הבקשה או הסריקה שבוצעה, והסיבה לכשל.

## הערות חשובות לבודק

- הבדיקה משנה את `weapons.json` במהלך הריצה.
- הסקריפט מאפס את `weapons.json` אוטומטית מתוך `weapons.source.json` בתחילת כל ריצה.
- לפני כל בדיקת אנדפוינט מתבצע איפוס נוסף, כדי שבדיקה אחת לא תשפיע על הבדיקה שאחריה.
- אם השרת לא רץ על `localhost:8000`, הבדיקות ייכשלו.
- אם התלמיד מחזיר שגיאות כ־`return {"error": "..."}` במקום `HTTPException`, בדרך כלל הסטטוס לא יהיה נכון ולכן הוא יאבד ניקוד.
- אם השרת שומר נתונים רק בזיכרון ולא בקובץ, הוא יאבד נקודות בבדיקות השמירה לקובץ.
- אם מריצים את הסקריפט מתיקייה אחרת, חובה להשתמש ב־`STUDENT_PROJECT_DIR`, אחרת הסריקה הסטטית והקריאה ל־`weapons.json` יהיו על התיקייה הלא נכונה.
- אם `weapons.source.json` לא נמצא ליד `index.js`, יש להשתמש ב־`WEAPONS_SOURCE_FILE`.
