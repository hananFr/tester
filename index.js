const fs = require('fs');
const path = require('path');

class HttpError extends Error {
    constructor(message, status, body) {
        super(message);
        this.status = status;
        this.body = body;
    }
}

/**
 * '
weapons/ GET מחזיר את כל הפריטים מהקובץ, ללא סינון 9
GET /weapons/{id}
מחזיר את הפריט לפי מזהה; פריט שלא קיים →
שגיאת 404
9
POST /weapons
מוסיף פריט, מזהה נוצר ע"י השרת )+1max),
נשמר לקובץ
9
PUT /weapons/{id}
מעדכן פריט קיים, נשמר לקובץ, לא נוצר פריט
חדש
9
{id{/weapons/ DELETE מוחק פריט לפי מזהה, נשמר לקובץ, הפריט נעלם 9
GET /weapons/by-condition?
condition=
מחזיר רק פריטים עם המצב שהתקבל 9
9 condition ∈ {new, good} וגם type לפי מסנן GET /weapons/combat-ready?type=
GET /weapons/summary/by-type
מחזיר ספירה דינמית לכל type( מחושב
9 מהנתונים, לא קשיח(
DELETE /weapons/by-condition?
condition=
מוחק את כל הפריטים המתאימים, נשמר לקובץ 8
 */

const BASE_URL = 'http://localhost:8000';
const PROJECT_DIR = process.env.STUDENT_PROJECT_DIR ? path.resolve(process.env.STUDENT_PROJECT_DIR) : __dirname;
const SOURCE_WEAPONS_FILE = process.env.WEAPONS_SOURCE_FILE
    ? path.resolve(process.env.WEAPONS_SOURCE_FILE)
    : path.join(__dirname, 'weapons.source.json');
const WEAPONS_FILE = path.join(PROJECT_DIR, 'weapons.json');
const GRADES_FILE = path.join(__dirname, 'grades.json');
const REQUIRED_FIELDS = ['type', 'model', 'ammo_type', 'condition'];
const RUN_ID = Date.now();
const SKIPPED_DIRS = new Set(['.git', '.venv', 'venv', 'env', '__pycache__', 'node_modules']);
const endpoints = [
    '/weapons',
    '/weapons/{id}',
    'POST /weapons',
    'PUT /weapons/{id}',
    'DELETE /weapons/{id}',
    '/weapons/by-condition',
    '/weapons/combat-ready',
    '/weapons/summary/by-type',
    'DELETE /weapons/by-condition'
];

const codeRequirements = [
    'fastapi_server_runs',
    'json_file_database',
    'logger_usage',
    'http_exception_usage'
];

function readWeaponsFile() {
    return JSON.parse(fs.readFileSync(WEAPONS_FILE, 'utf8'));
}

function resetWeaponsFile() {
    if (!fs.existsSync(SOURCE_WEAPONS_FILE)) {
        throw new Error(`Missing source data file: ${SOURCE_WEAPONS_FILE}`);
    }

    JSON.parse(fs.readFileSync(SOURCE_WEAPONS_FILE, 'utf8'));
    fs.copyFileSync(SOURCE_WEAPONS_FILE, WEAPONS_FILE);
}

function readPythonFiles(dir = PROJECT_DIR) {
    const files = [];

    if (!fs.existsSync(dir)) {
        return files;
    }

    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
        if (SKIPPED_DIRS.has(entry.name)) {
            continue;
        }

        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...readPythonFiles(fullPath));
        } else if (entry.isFile() && entry.name.endsWith('.py')) {
            files.push({
                path: fullPath,
                content: fs.readFileSync(fullPath, 'utf8')
            });
        }
    }

    return files;
}

function input(prompt = '') {
    if (prompt) {
        fs.writeSync(1, prompt);
    }

    const buffer = Buffer.alloc(1);
    let result = '';

    while (true) {
        const bytesRead = fs.readSync(0, buffer, 0, 1, null);
        if (bytesRead === 0) break;

        const char = buffer.toString();
        if (char === '\n') break;
        if (char !== '\r') {
            result += char;
        }
    }

    return result;
}

function writeGradesFile(result) {
    fs.writeFileSync(GRADES_FILE, `${JSON.stringify(result, null, 2)}\n`);
}

function sameJson(actual, expected) {
    return JSON.stringify(actual) === JSON.stringify(expected);
}

function maxId(weapons) {
    return weapons.reduce((max, weapon) => Math.max(max, Number(weapon.id)), 0);
}

function countByType(weapons) {
    return weapons.reduce((summary, weapon) => {
        summary[weapon.type] = (summary[weapon.type] || 0) + 1;
        return summary;
    }, {});
}

function containsWeapon(weapons, expectedWeapon) {
    return weapons.some((weapon) => sameJson(weapon, expectedWeapon));
}

function assertStatus(error, status) {
    return error instanceof HttpError && error.status === status;
}

async function request(method, route, body) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json'
        }
    };

    if (body !== undefined) {
        options.body = JSON.stringify(body);
    }

    const res = await fetch(`${BASE_URL}${route}`, options);
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;

    if (!res.ok) {
        const message = data?.detail || data?.message || data?.error || res.statusText;
        throw new HttpError(message, res.status, data);
    }

    return data;
}

const http = {
    get: (route) => request('GET', route),
    post: (route, body) => request('POST', route, body),
    put: (route, body) => request('PUT', route, body),
    delete: (route) => request('DELETE', route)
};

function createGradeSheet(studentName) {
    const grades = {
        name: studentName,
        endpoint_points: 0,
        code_quality_points: 0,
        code_requirements: {
            fastapi_server_runs: 0,
            json_file_database: 0,
            logger_usage: 0,
            http_exception_usage: 0
        },
        project_dir: PROJECT_DIR,
        weapons_file: WEAPONS_FILE,
        source_weapons_file: SOURCE_WEAPONS_FILE
    };

    endpoints.forEach((endpoint) => {
        grades[endpoint] = 0;
    });

    return grades;
}

async function gradeCodeRequirements(grades) {
    try {
        await http.get('/openapi.json');
        grades.code_requirements.fastapi_server_runs = 5;
    } catch (error) {
        console.log('FastAPI server check failed:', error.message);
    }

    const pythonFiles = readPythonFiles();
    const allPythonCode = pythonFiles.map((file) => file.content).join('\n');

    const usesFastApi = /from\s+fastapi\s+import[\s\S]*FastAPI|import\s+fastapi|fastapi\.FastAPI/.test(allPythonCode);
    if (usesFastApi && grades.code_requirements.fastapi_server_runs === 5) {
        grades.code_requirements.fastapi_server_runs = 5;
    } else if (usesFastApi) {
        grades.code_requirements.fastapi_server_runs = 3;
    }

    const mentionsWeaponsJson = /weapons\.json/.test(allPythonCode);
    const usesJsonModule = /import\s+json|from\s+json\s+import/.test(allPythonCode);
    const readsJson = /json\.load|json\.loads/.test(allPythonCode);
    const writesJson = /json\.dump|json\.dumps/.test(allPythonCode);
    const opensFile = /open\s*\(/.test(allPythonCode);

    if (mentionsWeaponsJson && usesJsonModule && readsJson && writesJson && opensFile) {
        grades.code_requirements.json_file_database = 5;
    }

    const usesLogger = /import\s+logging|from\s+logging\s+import|logging\.getLogger|logger\s*=|logger\.(info|error|warning|debug|exception)/.test(allPythonCode);
    const logsEvents = /logger\.(info|error|warning|debug|exception)|logging\.(info|error|warning|debug|exception)/.test(allPythonCode);

    if (usesLogger && logsEvents) {
        grades.code_requirements.logger_usage = 5;
    }

    const usesHttpException = /HTTPException/.test(allPythonCode);
    const importsHttpException = /from\s+fastapi\s+import[\s\S]*HTTPException|fastapi\.HTTPException/.test(allPythonCode);
    const returnsErrorObject = /return\s+[\{\(]\s*["']error["']/.test(allPythonCode);

    if (usesHttpException && importsHttpException && !returnsErrorObject) {
        grades.code_requirements.http_exception_usage = 5;
    } else if (usesHttpException && importsHttpException) {
        grades.code_requirements.http_exception_usage = 3;
    }
}

async function gradeGetWeapons(grades) {
    try {
        const fileWeapons = readWeaponsFile();
        const response = await http.get('/weapons');

        if (sameJson(response, fileWeapons)) {
            grades['/weapons'] += 5;
        }

        const beforeLength = fileWeapons.length;
        const freshWeapon = {
            type: 'rifle',
            model: `FILE-FRESHNESS-CHECK-${RUN_ID}`,
            ammo_type: '5.56mm',
            condition: 'new'
        };

        await http.post('/weapons', freshWeapon);
        const afterFile = readWeaponsFile();
        const afterResponse = await http.get('/weapons');
        const created = afterFile.find((weapon) => weapon.model === freshWeapon.model);

        if (afterFile.length === beforeLength + 1 && created && sameJson(afterResponse, afterFile)) {
            grades['/weapons'] += 4;
        }
    } catch (error) {
        console.log('GET /weapons failed:', error.message);
    }
}

async function gradeGetWeaponById(grades) {
    try {
        const weapons = readWeaponsFile();
        const expected = weapons[0];
        const response = await http.get(`/weapons/${expected.id}`);

        if (sameJson(response, expected)) {
            grades['/weapons/{id}'] += 5;
        }
    } catch (error) {
        console.log('GET /weapons/{id} valid case failed:', error.message);
    }

    try {
        const missingId = maxId(readWeaponsFile()) + 1000;
        await http.get(`/weapons/${missingId}`);
    } catch (error) {
        if (assertStatus(error, 404)) {
            grades['/weapons/{id}'] += 4;
        }
    }
}

async function gradePostWeapon(grades) {
    const weapon = {
        type: 'machine_gun',
        model: `POST-GRADE-MAG-${RUN_ID}`,
        ammo_type: '7.62mm',
        condition: 'good'
    };

    try {
        const before = readWeaponsFile();
        const expectedId = maxId(before) + 1;
        const response = await http.post('/weapons', weapon);
        const after = readWeaponsFile();
        const created = after.find((item) => item.id === expectedId);
        const responseLooksCreated = response === null || sameJson(response, created) || response.id === expectedId;

        if (
            created &&
            responseLooksCreated &&
            after.length === before.length + 1 &&
            created.id === expectedId &&
            REQUIRED_FIELDS.every((field) => created[field] === weapon[field])
        ) {
            grades['POST /weapons'] += 5;
        }

        if (containsWeapon(readWeaponsFile(), created)) {
            grades['POST /weapons'] += 1;
        }
    } catch (error) {
        console.log('POST /weapons valid case failed:', error.message);
    }

    const badCases = [
        {
            body: {type: 'rifle', model: 'BAD-CONDITION', ammo_type: '5.56mm', condition: 'good enough'},
            statuses: [400, 422]
        },
        {
            body: {type: 'rifle', ammo_type: '5.56mm', condition: 'new'},
            statuses: [400, 422]
        },
        {
            body: {id: 99999, type: 'rifle', model: 'CLIENT-ID', ammo_type: '5.56mm', condition: 'new'},
            statuses: [400, 422]
        }
    ];

    for (const badCase of badCases) {
        try {
            await http.post('/weapons', badCase.body);
        } catch (error) {
            if (error instanceof HttpError && badCase.statuses.includes(error.status)) {
                grades['POST /weapons'] += 1;
            }
        }
    }
}

async function gradePutWeapon(grades) {
    try {
        const before = readWeaponsFile();
        const target = before.find((weapon) => weapon.condition !== 'critical') || before[0];
        const update = {
            type: target.type,
            model: `PUT-GRADE-UPDATED-${RUN_ID}`,
            ammo_type: target.ammo_type,
            condition: 'critical'
        };

        const response = await http.put(`/weapons/${target.id}`, update);
        const after = readWeaponsFile();
        const updated = after.find((weapon) => weapon.id === target.id);
        const responseLooksUpdated = response === null || sameJson(response, updated) || response.id === target.id;

        if (
            updated &&
            responseLooksUpdated &&
            after.length === before.length &&
            updated.model === update.model &&
            updated.condition === update.condition
        ) {
            grades['PUT /weapons/{id}'] += 5;
        }

        const otherItemsUnchanged = before
            .filter((weapon) => weapon.id !== target.id)
            .every((weapon) => sameJson(weapon, after.find((item) => item.id === weapon.id)));

        if (otherItemsUnchanged && sameJson(readWeaponsFile().find((weapon) => weapon.id === target.id), updated)) {
            grades['PUT /weapons/{id}'] += 2;
        }
    } catch (error) {
        console.log('PUT /weapons/{id} valid case failed:', error.message);
    }

    try {
        await http.put(`/weapons/${maxId(readWeaponsFile()) + 1000}`, {
            type: 'rifle',
            model: 'M4',
            ammo_type: '5.56mm',
            condition: 'new'
        });
    } catch (error) {
        if (assertStatus(error, 404)) {
            grades['PUT /weapons/{id}'] += 2;
        }
    }
}

async function gradeDeleteWeapon(grades) {
    let deletedId;

    try {
        const before = readWeaponsFile();
        const target = before[before.length - 1];
        deletedId = target.id;
        await http.delete(`/weapons/${target.id}`);
        const after = readWeaponsFile();

        if (after.length === before.length - 1 && !after.some((weapon) => weapon.id === target.id)) {
            grades['DELETE /weapons/{id}'] += 5;
        }

        const onlyTargetDeleted = before
            .filter((weapon) => weapon.id !== target.id)
            .every((weapon) => sameJson(weapon, after.find((item) => item.id === weapon.id)));

        if (onlyTargetDeleted && !readWeaponsFile().some((weapon) => weapon.id === target.id)) {
            grades['DELETE /weapons/{id}'] += 2;
        }
    } catch (error) {
        console.log('DELETE /weapons/{id} valid case failed:', error.message);
    }

    try {
        await http.delete(`/weapons/${deletedId || maxId(readWeaponsFile()) + 1000}`);
    } catch (error) {
        if (assertStatus(error, 404)) {
            grades['DELETE /weapons/{id}'] += 2;
        }
    }
}

async function gradeByCondition(grades) {
    try {
        const weapons = readWeaponsFile();
        const condition = 'damaged';
        const expected = weapons.filter((weapon) => weapon.condition === condition);
        const response = await http.get(`/weapons/by-condition?condition=${condition}`);

        if (sameJson(response, expected)) {
            grades['/weapons/by-condition'] += 5;
        }

        if (response.every((weapon) => weapon.condition === condition)) {
            grades['/weapons/by-condition'] += 2;
        }
    } catch (error) {
        console.log('GET /weapons/by-condition valid case failed:', error.message);
    }

    try {
        const response = await http.get('/weapons/by-condition?condition=not-real-condition');
        if (Array.isArray(response) && response.length === 0) {
            grades['/weapons/by-condition'] += 2;
        }
    } catch (error) {
        if ([400, 404, 422].includes(error.status)) {
            grades['/weapons/by-condition'] += 2;
        }
    }
}

async function gradeCombatReady(grades) {
    try {
        const weapons = readWeaponsFile();
        const type = 'machine_gun';
        const expected = weapons.filter((weapon) => weapon.type === type && ['new', 'good'].includes(weapon.condition));
        const response = await http.get(`/weapons/combat-ready?type=${type}`);

        if (sameJson(response, expected)) {
            grades['/weapons/combat-ready'] += 5;
        }

        if (response.every((weapon) => weapon.type === type)) {
            grades['/weapons/combat-ready'] += 2;
        }

        if (response.every((weapon) => ['new', 'good'].includes(weapon.condition))) {
            grades['/weapons/combat-ready'] += 2;
        }
    } catch (error) {
        console.log('GET /weapons/combat-ready valid case failed:', error.message);
    }
}

async function gradeSummaryByType(grades) {
    try {
        const expected = countByType(readWeaponsFile());
        const response = await http.get('/weapons/summary/by-type');

        if (sameJson(response, expected)) {
            grades['/weapons/summary/by-type'] += 5;
        }

        const dynamicType = `summary_dynamic_type_${RUN_ID}`;
        const newTypeWeapon = {
            type: dynamicType,
            model: 'SUMMARY-DYNAMIC-CHECK',
            ammo_type: 'test',
            condition: 'new'
        };

        await http.post('/weapons', newTypeWeapon);
        const dynamicExpected = countByType(readWeaponsFile());
        const dynamicResponse = await http.get('/weapons/summary/by-type');

        if (sameJson(dynamicResponse, dynamicExpected) && dynamicResponse[dynamicType] === 1) {
            grades['/weapons/summary/by-type'] += 4;
        }
    } catch (error) {
        console.log('GET /weapons/summary/by-type failed:', error.message);
    }
}

async function gradeDeleteByCondition(grades) {
    const condition = 'critical';

    try {
        const before = readWeaponsFile();
        const expectedRemaining = before.filter((weapon) => weapon.condition !== condition);
        const expectedDeletedCount = before.length - expectedRemaining.length;

        await http.delete(`/weapons/by-condition?condition=${condition}`);
        const after = readWeaponsFile();

        if (expectedDeletedCount > 0 && sameJson(after, expectedRemaining)) {
            grades['DELETE /weapons/by-condition'] += 5;
        }

        if (!after.some((weapon) => weapon.condition === condition) && sameJson(readWeaponsFile(), expectedRemaining)) {
            grades['DELETE /weapons/by-condition'] += 3;
        }
    } catch (error) {
        console.log('DELETE /weapons/by-condition valid case failed:', error.message);
    }
}

async function testFastApi() {
    const studentName = input('Student Name \n');
    resetWeaponsFile();
    const grades = createGradeSheet(studentName);

    await gradeCodeRequirements(grades);
    await gradeGetWeapons(grades);
    await gradeGetWeaponById(grades);
    await gradePostWeapon(grades);
    await gradePutWeapon(grades);
    await gradeDeleteWeapon(grades);
    await gradeByCondition(grades);
    await gradeCombatReady(grades);
    await gradeSummaryByType(grades);
    await gradeDeleteByCondition(grades);

    grades.endpoint_points = endpoints.reduce((sum, endpoint) => sum + grades[endpoint], 0);
    grades.code_quality_points = codeRequirements.reduce((sum, requirement) => {
        return sum + grades.code_requirements[requirement];
    }, 0);
    grades.total = grades.endpoint_points + grades.code_quality_points;
    grades.max_score = 100;
    writeGradesFile(grades);
    console.log(grades);
}

testFastApi().catch((error) => {
    console.error('Test runner failed:', error.message);
});
