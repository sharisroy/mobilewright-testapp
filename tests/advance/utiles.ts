/// <reference types="node" />
import { execSync } from 'child_process';
import { expect } from '@mobilewright/test';

// ── Types ─────────────────────────────────────────────────────────────────────

export type LocatorItem = {
    name: string;
    locator: any;
};

export type UserFixture = {
    name: string;
    updatedName: string;
    email: string;
    oldPassword: string;
    newPassword: string;
    gender: string;
    dob: string; // DD/MM/YYYY
    address: string;
    mobile: string;
};

// ── Shared utilities ──────────────────────────────────────────────────────────

export const sleep = (ms: number): Promise<void> =>
    new Promise(resolve => setTimeout(resolve, ms));

// ── ADB device targeting (works with emulator + physical device connected) ─────

/**
 * Resolve which device adb should target. With both an emulator and a physical
 * device connected, raw `adb` is ambiguous, so we pick deterministically:
 *   1. ANDROID_SERIAL / MW_DEVICE_ID if set,
 *   2. otherwise the first PHYSICAL device (mobilewright.config.ts pins the same one),
 *   3. otherwise the first online device.
 */
export function getAdbSerial(): string {
    if (process.env.ANDROID_SERIAL) return process.env.ANDROID_SERIAL;
    if (process.env.MW_DEVICE_ID) return process.env.MW_DEVICE_ID;
    try {
        const out = execSync('adb devices', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
        const serials = out.split('\n')
            .filter(l => l.includes('\tdevice'))
            .map(l => l.split('\t')[0].trim());
        const physical = serials.find(s => !s.startsWith('emulator-'));
        return physical ?? serials[0] ?? '';
    } catch { return ''; }
}

/** Run an adb subcommand against the resolved serial so multi-device setups aren't ambiguous. */
export function adbExec(subcmd: string, opts: Parameters<typeof execSync>[1] = {}): string {
    const serial = getAdbSerial();
    const prefix = serial ? `adb -s ${serial}` : 'adb';
    return (execSync(`${prefix} ${subcmd}`, opts) ?? '') as unknown as string;
}

/**
 * Reads the device's real screen resolution via `wm size` so swipe/tap coordinates
 * can be expressed as fractions of the screen instead of hardcoded pixels. This is
 * what makes the scroll helpers work on BOTH the emulator and physical devices.
 * Falls back to a common 1080x2400 if the size can't be read.
 */
export function getScreenSize(): { width: number; height: number } {
    try {
        const out = adbExec('shell wm size', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
        // "Override size" wins over "Physical size" when the device is resized.
        const m = out.match(/Override size:\s*(\d+)x(\d+)/) ?? out.match(/Physical size:\s*(\d+)x(\d+)/);
        if (m) return { width: parseInt(m[1], 10), height: parseInt(m[2], 10) };
    } catch { /* fall through to default */ }
    return { width: 1080, height: 2400 };
}

// ── Error message strings (mirrors strings.xml) ───────────────────────────────

export const ERROR = {
    // Registration
    fullNameRequired:        'Full name is required',
    emailRequired:           'Email address is required',
    emailInvalid:            'Please enter a valid email address',
    emailAlreadyRegistered:  'This email is already registered',
    passwordRequired:        'Password is required',
    passwordLength:          'Password must be at least 8 characters',
    confirmPasswordRequired: 'Please confirm your password',
    passwordsMismatch:       'Passwords do not match',
    termsRequired:           'You must accept the Terms & Conditions to continue',
    // Login
    noAccount:               'No account found. Please register first.',
    invalidCredentials:      'Invalid email or password',
    // Change Password
    currentPasswordRequired: 'Current password is required',
    currentPasswordWrong:    'Current password is incorrect',
    passwordSameAsCurrent:   'New password must be different from current password',
    // Update Profile
    genderRequired:          'Please select a gender',
    dobRequired:             'Date of birth is required',
    maritalRequired:         'Please select your marital status',
    addressRequired:         'Address is required',
    mobileRequired:          'Mobile number is required',
    mobileInvalid:           'Please enter a valid mobile number (min 7 digits)',
} as const;

// ── Test data ─────────────────────────────────────────────────────────────────

const _runId = Date.now().toString(36);

export const collectAll = (nodes: any[], result: any[] = []): any[] => {
    for (const node of nodes) {
        result.push(node);
        if (node.children?.length) collectAll(node.children, result);
    }
    return result;
};

export const USER: UserFixture = {
    name: 'Haris Roy',
    updatedName: 'Haris Chandra Roy',
    email: `haris+${_runId}@mail.com`,
    oldPassword: 'Password123',
    newPassword: 'Password456',
    gender: 'Male',
    dob: '25/05/2001',
    address: '123 Main Street, Dhaka',
    mobile: '+912345678',
};

// ── Helper factory ────────────────────────────────────────────────────────────

/**
 * Returns all screen/device helpers scoped to the current test fixture.
 * Call this at the top of each test: `const { id, clearAppData, ... } = createHelpers(screen, device, APP_ID);`
 */
export function createHelpers(screen: any, device: any, APP_ID: string) {
    const id = (value: string) => `${APP_ID}:id/${value}`;

    // Resolve the adb serial once per test so all adb commands target the right
    // device even when an emulator and a physical device are both connected.
    const adbSerial = getAdbSerial();
    const adbCmd = (subcmd: string) => adbSerial ? `adb -s ${adbSerial} ${subcmd}` : `adb ${subcmd}`;

    // ── Tree traversal ────────────────────────────────────────────────────────

    const collectAll = (nodes: any[], result: any[] = []): any[] => {
        for (const node of nodes) {
            result.push(node);
            if (node.children?.length) collectAll(node.children, result);
        }
        return result;
    };

    const safeViewTree = async () => {
        try {
            return await screen.viewTree();
        } catch (error) {
            console.log('[warning] Could not read view tree:', error);
            return [];
        }
    };

    const findNodeByIdFromTree = async (resourceId: string) => {
        const nodes = collectAll(await safeViewTree());
        return nodes.find((node: any) =>
            node.isVisible &&
            (node.identifier === resourceId || node.resourceId === resourceId)
        );
    };

    const getVisibleTexts = async (): Promise<string[]> => {
        const nodes = collectAll(await safeViewTree());
        return nodes
            .filter((node: any) => node.isVisible && typeof node.text === 'string')
            .map((node: any) => node.text.trim())
            .filter(Boolean);
    };

    // ── ADB helpers ───────────────────────────────────────────────────────────

    const adbShell = (command: string): boolean => {
        try {
            execSync(adbCmd(`shell ${command}`), { stdio: 'ignore' });
            return true;
        } catch {
            return false;
        }
    };

    const adbKeyEvents = (keys: Array<string | number>): boolean => {
        if (!keys.length) return true;
        return adbShell(`input keyevent ${keys.join(' ')}`);
    };

    const clearAppData = () => {
        try {
            execSync(adbCmd(`shell pm clear ${APP_ID}`), { stdio: 'pipe' });
            console.log('[setup] App data cleared');
        } catch (e: any) {
            console.log('[setup] Could not clear app data:', e?.stderr?.toString().trim() || e?.message);
        }
    };

    // ── Keyboard helpers ──────────────────────────────────────────────────────

    const pressSingleDelete = async () => {
        const worked = await screen.pressButton('DEL')
            .then(() => true)
            .catch(async () =>
                screen.pressButton('BACKSPACE').then(() => true).catch(() => false)
            );

        if (!worked) {
            throw new Error('Could not press delete key via Mobilewright.');
        }
    };

    const pressDeleteKeys = async (count: number) => {
        if (count <= 0) return;

        const keys = Array.from({ length: count }, () => 67); // KEYCODE_DEL

        for (let i = 0; i < keys.length; i += 20) {
            const chunk = keys.slice(i, i + 20);
            const adbWorked = adbKeyEvents(chunk);

            if (!adbWorked) {
                for (let j = 0; j < chunk.length; j++) {
                    await pressSingleDelete();
                    await sleep(50);
                }
            }

            await sleep(100);
        }
    };

    const dismissKeyboard = async () => {
        await screen.pressButton('BACK').catch(() => {});
        await sleep(200);
    };

    // ── Visibility / wait helpers ─────────────────────────────────────────────

    const waitForTextVisible = async (text: string, timeout = 20_000): Promise<boolean> => {
        const deadline = Date.now() + timeout;
        while (Date.now() < deadline) {
            const visible = await screen.getByText(text).isVisible().catch(() => false);
            if (visible) return true;
            await sleep(500);
        }
        return false;
    };

    const dumpVisibleUi = async (title: string) => {
        console.log(`\n====== ${title} ======\n`);
        const nodes = collectAll(await safeViewTree());
        for (const node of nodes) {
            if (!node.isVisible) continue;
            if (!node.text && !node.label && !node.identifier && !node.resourceId) continue;
            console.log({
                text: node.text,
                label: node.label,
                identifier: node.identifier,
                resourceId: node.resourceId,
            });
        }
        console.log(`\n====== End ${title} ======\n`);
    };

    const waitForProfileScreen = async (timeout = 20_000) => {
        const visible = await waitForTextVisible('My Profile', timeout);
        if (!visible) {
            await dumpVisibleUi('Current UI while waiting for My Profile');
            throw new Error('Expected My Profile screen, but app did not navigate there.');
        }
    };

    // ── Field interaction helpers ─────────────────────────────────────────────

    const fillFreshText = async (locator: any, value: string) => {
        await locator.tap();
        await sleep(100);
        await locator.fill(value);
        await sleep(150);
    };

    const assertFieldValue = async (resourceId: string, expectedValue: string) => {
        await sleep(200);
        const node = await findNodeByIdFromTree(resourceId);
        const actualValue = (node as any)?.text || '';
        console.log(`[verify field] ${resourceId}`);
        console.log(`  Expected: ${expectedValue}`);
        console.log(`  Actual:   ${actualValue}`);
        expect(actualValue).toBe(expectedValue);
    };

    const clearAndFillById = async ({
        resourceId,
        locator,
        value,
        verify = true,
    }: {
        resourceId: string;
        locator: any;
        value: string;
        verify?: boolean;
    }) => {
        await (expect(locator) as any).toBeVisible({ timeout: 10_000 });
        await locator.tap();
        await sleep(150);

        const beforeNode = await findNodeByIdFromTree(resourceId);
        const beforeText = typeof (beforeNode as any)?.text === 'string'
            ? (beforeNode as any).text
            : '';

        console.log(`[clear field] ${resourceId}`);
        console.log(`  Before: "${beforeText}"`);
        console.log(`  New:    "${value}"`);

        if (beforeText === value) {
            console.log('[clear field] Value already correct — skipping fill.');
            return;
        }

        adbKeyEvents([123]); // KEYCODE_MOVE_END — move cursor to end before deleting
        await sleep(100);

        const deleteCount = beforeText.length > 0 ? beforeText.length + 3 : 0;
        await pressDeleteKeys(deleteCount);
        await sleep(150);

        await locator.fill(value);
        await sleep(300);

        if (verify) {
            await assertFieldValue(resourceId, value);
        }
    };

    // ── Element discovery helpers ─────────────────────────────────────────────

    const findVisibleElement = async (locators: LocatorItem[], maxSwipes = 0) => {
        for (let i = 0; i <= maxSwipes; i++) {
            for (const item of locators) {
                if (await item.locator.isVisible().catch(() => false)) {
                    console.log(`[found] ${item.name}`);
                    return item.locator;
                }
            }
            if (i < maxSwipes) {
                await device.driver.swipe('up', { distance: 650 });
                await sleep(300);
            }
        }
        throw new Error(
            `Could not find visible element: ${locators.map(item => item.name).join(', ')}`
        );
    };

    // ── Date picker ───────────────────────────────────────────────────────────

    const selectDate = async (targetDay: number, targetMonth: number, targetYear: number) => {
        // The picker opens to a default of 18 years before today.
        const defaultDate = new Date();
        defaultDate.setFullYear(defaultDate.getFullYear() - 18);
        const defaultMonth = defaultDate.getMonth() + 1; // 1-based

        await screen.getByTestId(id('et_dob')).tap();
        await sleep(600);

        // Switch to year-list view by tapping the year shown in the dialog header.
        const treeNodes = collectAll(await safeViewTree());
        const yearHeaderNode = treeNodes.find((n: any) =>
            n.isVisible && typeof n.text === 'string' && /^\d{4}$/.test(n.text.trim())
        );

        if (yearHeaderNode) {
            const b = yearHeaderNode.bounds;
            const bx = b.x ?? b.left ?? 0;
            const by = b.y ?? b.top ?? 0;
            const bw = b.width ?? ((b.right ?? 0) - bx);
            const bh = b.height ?? ((b.bottom ?? 0) - by);
            await device.driver.tap(Math.round(bx + bw / 2), Math.round(by + bh / 2));
        } else {
            await screen.getByText(String(defaultDate.getFullYear())).tap();
        }
        await sleep(400);

        // Scroll year list — years are in ascending order; swipe down to reveal earlier years.
        for (let attempt = 0; attempt < 40; attempt++) {
            if (await screen.getByText(String(targetYear)).isVisible().catch(() => false)) break;
            await device.driver.swipe('down', { distance: 200 });
            await sleep(150);
        }
        await screen.getByText(String(targetYear)).tap();
        await sleep(400);

        // Navigate to the target month using the prev/next arrows.
        const monthDiff = targetMonth - defaultMonth;
        if (monthDiff > 0) {
            for (let i = 0; i < monthDiff; i++) {
                const nextVisible = await screen.getByLabel('Next month').isVisible().catch(() => false);
                await (nextVisible
                    ? screen.getByLabel('Next month')
                    : screen.getByLabel('next month')
                ).tap();
                await sleep(200);
            }
        } else if (monthDiff < 0) {
            for (let i = 0; i < Math.abs(monthDiff); i++) {
                const prevVisible = await screen.getByLabel('Previous month').isVisible().catch(() => false);
                await (prevVisible
                    ? screen.getByLabel('Previous month')
                    : screen.getByLabel('previous month')
                ).tap();
                await sleep(200);
            }
        }

        await screen.getByText(String(targetDay)).tap();
        await sleep(200);
        await screen.getByText('OK').tap();
        await sleep(300);
    };

    // ── Dropdown helper ───────────────────────────────────────────────────────

    const selectDropdownItem = async ({
        fieldResourceId,
        label,
    }: {
        fieldResourceId: string;
        label: string;
    }) => {
        console.log(`[step] Selecting "${label}" from dropdown`);

        const fieldNode = await findNodeByIdFromTree(fieldResourceId);
        if (!fieldNode) {
            throw new Error(`Could not find dropdown field: ${fieldResourceId}`);
        }

        const fb = fieldNode.bounds;
        const fx = fb.x ?? fb.left ?? 0;
        const fy = fb.y ?? fb.top ?? 0;
        const fw = fb.width ?? fb.w ?? ((fb.right ?? 0) - fx);
        const fh = fb.height ?? fb.h ?? ((fb.bottom ?? 0) - fy);
        const cx = Math.round(fx + fw / 2);
        const cy = Math.round(fy + fh / 2);
        const bottom = fy + fh;

        // Tap the field then probe below it at increasing offsets until the value matches.
        let selected = false;
        for (let offset = 40; offset <= 600 && !selected; offset += 40) {
            await device.driver.tap(cx, cy);
            await sleep(500);
            await device.driver.tap(cx, Math.round(bottom + offset));
            await sleep(300);

            const afterNode = await findNodeByIdFromTree(fieldResourceId);
            if ((afterNode as any)?.text === label) selected = true;
        }

        if (!selected) {
            throw new Error(`Could not select "${label}" from dropdown`);
        }

        await sleep(200);

        const finalNode = await findNodeByIdFromTree(fieldResourceId);
        const finalText = (finalNode as any)?.text || '';
        if (finalText !== label) {
            throw new Error(`Failed to select "${label}" from dropdown. Current value: "${finalText}"`);
        }

        console.log(`[success] Selected "${label}"`);
    };

    // ── Profile assertions ────────────────────────────────────────────────────

    const assertProfileHeader = async (expectedName: string, expectedEmail: string) => {
        await waitForProfileScreen();
        const nodes = collectAll(await safeViewTree());

        const byLabel = (label: string) => nodes.find((n: any) => n.label === label);
        const byText = (text: string) => nodes.find((n: any) => n.text === text);

        const pageTitle = byText('My Profile')?.text;
        const profileName = byLabel('Profile Name')?.text;
        const profileEmail = byLabel('Profile Email')?.text;

        console.log('Page title:',    pageTitle);
        console.log('Profile name:',  profileName);
        console.log('Profile email:', profileEmail);

        expect(pageTitle).toBe('My Profile');
        expect(profileName).toBe(expectedName);
        expect(profileEmail).toBe(expectedEmail);
    };

    const assertVisibleTextExistsWithScroll = async (value: string, maxSwipes = 6) => {
        for (let i = 0; i <= maxSwipes; i++) {
            const found = (await getVisibleTexts()).includes(value);
            console.log(`[verify] "${value}" found: ${found}`);

            if (found) {
                expect(found).toBe(true);
                return;
            }

            if (i < maxSwipes) {
                await device.driver.swipe('up', { distance: 500 });
                await sleep(250);
            }
        }

        await dumpVisibleUi(`Could not find visible text: ${value}`);
        throw new Error(`Could not find visible text: ${value}`);
    };

    // ── Setup shortcuts ───────────────────────────────────────────────────────

    const freshLaunchToLogin = async () => {
        await device.terminateApp(APP_ID).catch(() => {});
        clearAppData();
        await device.launchApp(APP_ID);
        await sleep(2_000); // let UIAutomator attach after pm clear + relaunch
        await (expect(screen.getByLabel('Sign In Title')) as any).toBeVisible({ timeout: 20_000 });
    };

    const registerAndGoToLogin = async (
        name    = USER.name,
        email   = USER.email,
        password = USER.oldPassword,
    ) => {
        await (expect(screen.getByLabel('Create Account Heading')) as any).toBeVisible({ timeout: 20_000 });
        await fillFreshText(screen.getByLabel('Full Name Edit Text'), name);
        await fillFreshText(screen.getByLabel('Email Edit Text'), email);
        await fillFreshText(screen.getByLabel('Password Edit Text'), password);
        await fillFreshText(screen.getByLabel('Confirm Password Edit Text'), password);
        await dismissKeyboard();
        await screen.getByLabel('Register Button').tap();
        await (expect(screen.getByLabel('Sign In Title')) as any).toBeVisible({ timeout: 15_000 });
    };

    const loginAndGoToProfile = async (
        email    = USER.email,
        password = USER.oldPassword,
    ) => {
        await (expect(screen.getByLabel('Sign In Title')) as any).toBeVisible({ timeout: 20_000 });
        await fillFreshText(screen.getByTestId(id('et_login_email')), email);
        // Dismiss the on-screen keyboard before filling the password field — it
        // can overlap the password field's tap target and cause the typed text
        // to land in the still-focused email field instead.
        await dismissKeyboard();
        await fillFreshText(screen.getByTestId(id('et_login_password')), password);
        await dismissKeyboard();
        await screen.getByTestId(id('btn_login')).tap();
        await waitForProfileScreen(15_000);
    };

    // ── Error detection ───────────────────────────────────────────────────────

    /**
     * Returns true if a visible node's text contains `text` (case-insensitive).
     * When `text` is omitted, matches any node containing common error keywords.
     * Use as a soft assertion — does not throw on false.
     */
    const waitForErrorVisible = async (text?: string, timeout = 8_000): Promise<boolean> => {
        const deadline = Date.now() + timeout;
        const errorKeywords = [
            'invalid', 'incorrect', 'already', 'mismatch',
            "don't match", 'do not match', 'required', 'failed',
        ];

        while (Date.now() < deadline) {
            const texts = await getVisibleTexts();
            const found = text
                ? texts.some(t => t.toLowerCase().includes(text.toLowerCase()))
                : texts.some(t => errorKeywords.some(kw => t.toLowerCase().includes(kw)));
            if (found) return true;
            await sleep(500);
        }
        return false;
    };

    // ── Screen-transition helpers ─────────────────────────────────────────────

    const tapSaveProfileAndReturnToProfile = async () => {
        console.log('[step] Save Profile');

        const saveButton = await findVisibleElement([
            { name: 'btn_save_profile (testId)',  locator: screen.getByTestId(id('btn_save_profile')) },
            { name: 'Save Profile Button (label)', locator: screen.getByLabel('Save Profile Button') },
        ], 5);

        await saveButton.tap();
        console.log('[step] Waiting after Save Profile tap');
        await sleep(1000);

        if (await waitForTextVisible('My Profile', 8_000)) {
            console.log('[success] App returned to My Profile automatically');
            return;
        }

        const stillOnUpdateProfile =
            await screen.getByText('Update Profile').isVisible().catch(() => false) ||
            await screen.getByLabel('Update Profile Section').isVisible().catch(() => false);

        if (stillOnUpdateProfile) {
            console.log('[info] App stayed on Update Profile — pressing Back to return');
            await dismissKeyboard();
            await screen.pressButton('BACK').catch(() => {});
            await sleep(2000);
        }

        await waitForProfileScreen(20_000);
    };

    const tapUpdatePasswordAndReturnToProfile = async () => {
        console.log('[step] Update Password');

        await screen.getByTestId(id('btn_update_password')).tap();
        await sleep(1000);

        if (await waitForTextVisible('My Profile', 8_000)) {
            console.log('[success] App returned to My Profile after password update');
            return;
        }

        const stillOnChangePassword =
            await screen.getByText('Change Password').isVisible().catch(() => false) ||
            await screen.getByLabel('Change Password Section').isVisible().catch(() => false);

        if (stillOnChangePassword) {
            console.log('[info] App stayed on Change Password — pressing Back to return');
            await dismissKeyboard();
            await screen.pressButton('BACK').catch(() => {});
            await sleep(2000);
        }

        await waitForProfileScreen(20_000);
    };

    // ── Public API ────────────────────────────────────────────────────────────

    return {
        id,
        // ADB / app lifecycle
        adbShell,
        clearAppData,
        freshLaunchToLogin,
        // Form interaction
        fillFreshText,
        clearAndFillById,
        dismissKeyboard,
        // Setup shortcuts
        registerAndGoToLogin,
        loginAndGoToProfile,
        // UI interaction
        selectDate,
        selectDropdownItem,
        findVisibleElement,
        // Assertions
        assertProfileHeader,
        assertVisibleTextExistsWithScroll,
        waitForErrorVisible,
        // Screen transitions
        tapSaveProfileAndReturnToProfile,
        tapUpdatePasswordAndReturnToProfile,
    };
}
