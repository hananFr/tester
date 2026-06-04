# מדריך לבודק

הקובץ `index.js` הוא סקריפט בדיקה אוטומטי למבחן FastAPI של מחסן הנשק.  
הוא מריץ בקשות מול שרת FastAPI שרץ מקומית על `http://localhost:8000`, סורק את קוד ה־Python של התלמיד, בודק את האנדפוינטים, ומייצר ציון בקובץ `grades.json`.

## לפני הרצה

1. ודא שהגשת התלמיד כוללת שרת FastAPI תקין.
2. ודא שהשרת משתמש בקובץ `weapons.json` כבסיס נתונים.
3. הפעל את שרת התלמיד על פורט `8000`.

דוגמה להרצת שרת:

```bash
uvicorn main:app --reload
```

אם קובץ השרת של התלמיד לא נקרא `main.py`, יש להתאים את הפקודה לשם הקובץ והאובייקט `app`.

## מאיפה מריצים

הדרך המומלצת: להעתיק את `index.js`, `package.json`, `weapons.json` ו־`weapons.source.json` לתיקיית הפרויקט של התלמיד, ואז להריץ משם:

```bash
node index.js
```

במצב הזה הסקריפט:

- קורא את `weapons.json` מתוך תיקיית הפרויקט.
- מאפס בתחילת כל ריצה את `weapons.json` לפי `weapons.source.json`.
- סורק את קבצי ה־`.py` של התלמיד באותה תיקייה.
- שומר את התוצאה ב־`grades.json` ליד `index.js`.

אפשרות נוספת: להשאיר את הסקריפט בתיקיית הבודק ולהעביר לו את נתיב הפרויקט של התלמיד:

```bash
STUDENT_PROJECT_DIR=/path/to/student/project node index.js
```

במצב הזה הסקריפט יקרא את `weapons.json` ויסרוק את קבצי ה־Python מתוך `STUDENT_PROJECT_DIR`, אבל עדיין ישמור את `grades.json` בתיקייה שממנה נמצא `index.js`.

אם קובץ המקור נמצא במקום אחר, אפשר להעביר גם אותו:

```bash
STUDENT_PROJECT_DIR=/path/to/student/project WEAPONS_SOURCE_FILE=/path/to/weapons.source.json node index.js
```

חשוב: שרת התלמיד חייב להשתמש באותו `weapons.json` שהסקריפט קורא ממנו. לכן הכי פשוט ובטוח להריץ את הסקריפט מתוך תיקיית הפרויקט של התלמיד.

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

לאחר הכנסת השם, הסקריפט יריץ את כל הבדיקות וישמור את התוצאה ב־`grades.json`.

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

בכל אנדפוינט, הבדיקה המרכזית של קלט תקין שווה בדרך כלל `5` נקודות. שאר הנקודות ניתנות על מקרי קצה, שגיאות תקינות, ושמירה אמיתית לקובץ הנתונים.

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
- החזרת `404` עבור פריט שלא קיים.
- הוספת פריט חדש עם `id` שנוצר בשרת לפי `max id + 1`.
- דחיית גוף בקשה לא תקין ב־`POST`.
- עדכון פריט קיים בלי ליצור פריט חדש.
- מחיקת פריט קיים בלבד.
- סינון לפי `condition`.
- סינון כלי נשק מוכנים ללחימה לפי `type` ו־`condition` שהוא `new` או `good`.
- חישוב דינמי של כמות פריטים לפי `type`.
- מחיקת כל הפריטים לפי `condition`.
- שהפעולות שמשנות מידע באמת מעדכנות את קובץ ה־JSON, ולא רק משתנה בזיכרון.

הערה על מחיקה: `DELETE /weapons/{id}` נבדק על פריט שכבר קיים ב־`weapons.json` לאחר האיפוס. לכן גם אם `POST /weapons` לא עובד, עדיין אפשר לקבל ניקוד על מחיקה לפי מזהה.

## פלט

בסיום הריצה יווצר או יעודכן הקובץ `grades.json`.

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
  "/weapons": 9,
  "/weapons/{id}": 9,
  "POST /weapons": 9,
  "PUT /weapons/{id}": 9,
  "DELETE /weapons/{id}": 9,
  "/weapons/by-condition": 9,
  "/weapons/combat-ready": 9,
  "/weapons/summary/by-type": 9,
  "DELETE /weapons/by-condition": 8,
  "total": 100,
  "max_score": 100
}
```

## הערות חשובות לבודק

- הבדיקה משנה את `weapons.json` במהלך הריצה.
- הסקריפט מאפס את `weapons.json` אוטומטית מתוך `weapons.source.json` בתחילת כל ריצה.
- אם השרת לא רץ על `localhost:8000`, הבדיקות ייכשלו.
- אם התלמיד מחזיר שגיאות כ־`return {"error": "..."}` במקום `HTTPException`, בדרך כלל הסטטוס לא יהיה נכון ולכן הוא יאבד ניקוד.
- אם השרת שומר נתונים רק בזיכרון ולא בקובץ, הוא יאבד נקודות בבדיקות השמירה לקובץ.
- אם מריצים את הסקריפט מתיקייה אחרת, חובה להשתמש ב־`STUDENT_PROJECT_DIR`, אחרת הסריקה הסטטית והקריאה ל־`weapons.json` יהיו על התיקייה הלא נכונה.
- אם `weapons.source.json` לא נמצא ליד `index.js`, יש להשתמש ב־`WEAPONS_SOURCE_FILE`.
