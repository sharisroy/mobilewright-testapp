import { test, expect } from '@mobilewright/test';
import { createHelpers, sleep, USER, ERROR } from './utiles';

const APP_ID = 'com.haris.testapp';

test.use({ bundleId: APP_ID, platform: 'android' });

test('launch the app registration, login, update the profile change the password, login again', { tag: ['@regression', '@sanity'] }, async ({ screen, device }) => {
    test.setTimeout(600_000);
    const {
        id,
        clearAppData,
        fillFreshText,
        clearAndFillById,
        dismissKeyboard,
        selectDate,
        selectDropdownItem,
        findVisibleElement,
        assertProfileHeader,
        assertVisibleTextExistsWithScroll,
        tapSaveProfileAndReturnToProfile,
        tapUpdatePasswordAndReturnToProfile,
    } = createHelpers(screen, device, APP_ID);

    // ── Clean start ───────────────────────────────────────────────────────────

    await device.terminateApp(APP_ID).catch(() => {});
    clearAppData();
    await device.launchApp(APP_ID);

    // ── Home screen ───────────────────────────────────────────────────────────

    await expect(screen.getByLabel('Sign In Title')).toBeVisible({ timeout: 20_000 });
    await screen.getByLabel('Create Account Button').tap();

    // ── Registration ──────────────────────────────────────────────────────────

    await expect(screen.getByLabel('Create Account Heading')).toBeVisible({ timeout: 20_000 });

    await fillFreshText(screen.getByLabel('Full Name Edit Text'), USER.name);
    await fillFreshText(screen.getByLabel('Email Edit Text'), USER.email);
    await fillFreshText(screen.getByLabel('Password Edit Text'), USER.oldPassword);
    await fillFreshText(screen.getByLabel('Confirm Password Edit Text'), USER.oldPassword);

    await dismissKeyboard();

    await screen.getByLabel('Register Button').tap();
    await expect(screen.getByLabel('Sign In Title')).toBeVisible({ timeout: 15_000 });

    // ── Login with old password ───────────────────────────────────────────────

    await expect(screen.getByLabel('Sign In Title')).toBeVisible({ timeout: 20_000 });

    await fillFreshText(screen.getByTestId(id('et_login_email')), USER.email);
    // Dismiss the on-screen keyboard before filling the password field — it
    // can overlap the password field's tap target and cause the typed text
    // to land in the still-focused email field instead.
    await dismissKeyboard();
    await fillFreshText(screen.getByTestId(id('et_login_password')), USER.oldPassword);

    await dismissKeyboard();

    await screen.getByTestId(id('btn_login')).tap();

    // ── Profile screen after registration ─────────────────────────────────────

    await assertProfileHeader(USER.name, USER.email);

    // ── Update Profile ────────────────────────────────────────────────────────

    console.log('[step] Tapping Update Profile Button');

    await screen.getByLabel('Update Profile Button').tap();
    await expect(screen.getByLabel('Update Profile Section')).toBeVisible({ timeout: 20_000 });
    await sleep(500);

    // Full Name
    console.log('[step] Full Name — update to:', USER.updatedName);

    await clearAndFillById({
        resourceId: id('et_full_name'),
        locator: screen.getByTestId(id('et_full_name')),
        value: USER.updatedName,
        verify: true,
    });

    await dismissKeyboard();

    // Date of Birth
    console.log('[step] Date of Birth');

    const [dobDay, dobMonth, dobYear] = USER.dob.split('/').map(Number);
    await selectDate(dobDay, dobMonth, dobYear);

    // Gender
    console.log('[step] Gender →', USER.gender);

    await selectDropdownItem({
        fieldResourceId: id('acv_gender'),
        label: USER.gender,
    });

    // Marital Status
    console.log('[step] Marital Status → Single');

    await screen.getByTestId(id('rb_single')).tap();
    await sleep(150);

    // Address
    console.log('[step] Address');

    await fillFreshText(screen.getByTestId(id('et_address')), USER.address);

    await dismissKeyboard();

    // Scroll to reveal bottom fields
    console.log('[step] Scrolling to reveal bottom fields');

    for (let i = 0; i < 4; i++) {
        await device.driver.swipe('up', { distance: 400 });
        await sleep(250);
    }

    // Mobile
    console.log('[step] Mobile');

    const mobileField = await findVisibleElement([
        { name: 'et_mobile (testId)',          locator: screen.getByTestId(id('et_mobile')) },
        { name: 'Mobile Number Edit Text (label)', locator: screen.getByLabel('Mobile Number Edit Text') },
    ], 5);

    await fillFreshText(mobileField, USER.mobile);

    await dismissKeyboard();

    // Terms & Conditions checkbox
    console.log('[step] Accept Terms & Conditions');

    const termsCheckbox = await findVisibleElement([
        { name: 'cb_terms (testId)',                    locator: screen.getByTestId(id('cb_terms')) },
        { name: 'Accept Terms and Conditions (label)',  locator: screen.getByLabel('Accept Terms and Conditions') },
    ], 3);

    await termsCheckbox.tap();
    await sleep(200);

    // Save profile and return
    await tapSaveProfileAndReturnToProfile();

    console.log('[step] Profile saved — verifying updated profile');

    // ── Verify updated profile ────────────────────────────────────────────────

    await assertProfileHeader(USER.updatedName, USER.email);
    await assertVisibleTextExistsWithScroll(USER.dob);
    await assertVisibleTextExistsWithScroll(USER.gender);
    await assertVisibleTextExistsWithScroll('Single');
    await assertVisibleTextExistsWithScroll(USER.address);
    await assertVisibleTextExistsWithScroll(USER.mobile);

    // ── Change Password ───────────────────────────────────────────────────────

    console.log('[step] Open Change Password');

    const changePasswordButton = await findVisibleElement([
        { name: 'btn_change_password (testId)', locator: screen.getByTestId(id('btn_change_password')) },
        { name: 'Change Password Button (label)', locator: screen.getByLabel('Change Password Button') },
    ], 8);

    await changePasswordButton.tap();

    await expect(screen.getByLabel('Change Password Section')).toBeVisible({ timeout: 20_000 });

    console.log('[step] Fill Change Password form');

    await fillFreshText(screen.getByTestId(id('et_current_password')), USER.oldPassword);
    await dismissKeyboard();
    await fillFreshText(screen.getByTestId(id('et_new_password')), USER.newPassword);
    await dismissKeyboard();
    await fillFreshText(screen.getByTestId(id('et_confirm_new_password')), USER.newPassword);

    await dismissKeyboard();

    await tapUpdatePasswordAndReturnToProfile();

    await assertProfileHeader(USER.updatedName, USER.email);

    // ── Logout ────────────────────────────────────────────────────────────────

    console.log('[step] Logout');

    const logoutButton = await findVisibleElement([
        { name: 'btn_logout (testId)',   locator: screen.getByTestId(id('btn_logout')) },
        { name: 'Logout Button (label)', locator: screen.getByLabel('Logout Button') },
    ], 8);

    await logoutButton.tap();

    await expect(screen.getByLabel('Sign In Title')).toBeVisible({ timeout: 20_000 });

    // ── Login again with new password ─────────────────────────────────────────

    console.log('[step] Login again with new password');

    await fillFreshText(screen.getByTestId(id('et_login_email')), USER.email);
    await dismissKeyboard();
    await fillFreshText(screen.getByTestId(id('et_login_password')), USER.newPassword);

    await dismissKeyboard();

    await screen.getByTestId(id('btn_login')).tap();

    // ── Final profile verification ────────────────────────────────────────────

    console.log('[step] Final profile verification');

    await assertProfileHeader(USER.updatedName, USER.email);

    console.log('[done] Happy path complete');
});

// ══════════════════════════════════════════════════════════════════════════════
// Negative tests
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Negative: Registration', () => {
    test.describe.configure({ timeout: 180_000 });

    test('rejects mismatched confirm password', { tag: ['@negative'] }, async ({ screen, device }) => {
        const {
            freshLaunchToLogin, fillFreshText, dismissKeyboard, waitForErrorVisible,
        } = createHelpers(screen, device, APP_ID);

        await freshLaunchToLogin();
        await screen.getByLabel('Create Account Button').tap();
        await expect(screen.getByLabel('Create Account Heading')).toBeVisible({ timeout: 20_000 });

        await fillFreshText(screen.getByLabel('Full Name Edit Text'), USER.name);
        await fillFreshText(screen.getByLabel('Email Edit Text'), USER.email);
        await fillFreshText(screen.getByLabel('Password Edit Text'), USER.oldPassword);
        await fillFreshText(screen.getByLabel('Confirm Password Edit Text'), 'WrongConfirm999');
        await dismissKeyboard();

        await screen.getByLabel('Register Button').tap();
        await sleep(3_000);

        // Must stay on registration — not navigate to login
        await expect(screen.getByLabel('Create Account Heading')).toBeVisible({ timeout: 5_000 });
        const errorShown = await waitForErrorVisible(ERROR.passwordsMismatch, 5_000);
        expect(errorShown).toBe(true);
    });

    test('blocks submission with all fields empty', { tag: ['@negative'] }, async ({ screen, device }) => {
        const { freshLaunchToLogin, waitForErrorVisible } = createHelpers(screen, device, APP_ID);

        await freshLaunchToLogin();
        await screen.getByLabel('Create Account Button').tap();
        await expect(screen.getByLabel('Create Account Heading')).toBeVisible({ timeout: 20_000 });

        // Tap Register without filling any field
        await screen.getByLabel('Register Button').tap();
        await sleep(2_000);

        // Must stay on registration screen and show the first field's inline error
        await expect(screen.getByLabel('Create Account Heading')).toBeVisible({ timeout: 5_000 });
        const errorShown = await waitForErrorVisible(ERROR.fullNameRequired, 5_000);
        expect(errorShown).toBe(true);
    });

    test('rejects duplicate email', { tag: ['@negative'] }, async ({ screen, device }) => {
        const {
            freshLaunchToLogin, registerAndGoToLogin,
            fillFreshText, dismissKeyboard, waitForErrorVisible,
        } = createHelpers(screen, device, APP_ID);

        await freshLaunchToLogin();
        await screen.getByLabel('Create Account Button').tap();
        await registerAndGoToLogin(); // first registration — succeeds

        // Try to register again with the same email
        await screen.getByLabel('Create Account Button').tap();
        await expect(screen.getByLabel('Create Account Heading')).toBeVisible({ timeout: 20_000 });

        await fillFreshText(screen.getByLabel('Full Name Edit Text'), USER.name);
        await fillFreshText(screen.getByLabel('Email Edit Text'), USER.email); // same email
        await fillFreshText(screen.getByLabel('Password Edit Text'), USER.oldPassword);
        await fillFreshText(screen.getByLabel('Confirm Password Edit Text'), USER.oldPassword);
        await dismissKeyboard();

        await screen.getByLabel('Register Button').tap();
        await sleep(5_000);

        // Must NOT land on profile screen
        const onProfile = await screen.getByText('My Profile').isVisible().catch(() => false);
        expect(onProfile).toBe(false);

        const errorShown = await waitForErrorVisible(ERROR.emailAlreadyRegistered, 5_000);
        expect(errorShown).toBe(true);
    });

});

test.describe('Negative: Login', () => {
    test.describe.configure({ timeout: 180_000 });

    test('rejects wrong password', { tag: ['@negative'] }, async ({ screen, device }) => {
        const {
            id, freshLaunchToLogin, registerAndGoToLogin,
            fillFreshText, dismissKeyboard, waitForErrorVisible,
        } = createHelpers(screen, device, APP_ID);

        await freshLaunchToLogin();
        await screen.getByLabel('Create Account Button').tap();
        await registerAndGoToLogin(); // register then lands on login

        // Attempt login with wrong password
        await fillFreshText(screen.getByTestId(id('et_login_email')), USER.email);
        // Dismiss the on-screen keyboard before filling the password field — it
        // can overlap the password field's tap target and cause the typed text
        // to land in the still-focused email field instead.
        await dismissKeyboard();
        await fillFreshText(screen.getByTestId(id('et_login_password')), 'WrongPass000');
        await dismissKeyboard();
        await screen.getByTestId(id('btn_login')).tap();
        await sleep(4_000);

        // Must stay on login — not navigate to profile
        await expect(screen.getByLabel('Sign In Title')).toBeVisible({ timeout: 5_000 });
        const errorShown = await waitForErrorVisible(ERROR.invalidCredentials, 5_000);
        expect(errorShown).toBe(true);
    });

    test('rejects unregistered email', { tag: ['@negative'] }, async ({ screen, device }) => {
        const {
            id, freshLaunchToLogin,
            fillFreshText, dismissKeyboard, waitForErrorVisible,
        } = createHelpers(screen, device, APP_ID);

        await freshLaunchToLogin(); // no registration — fresh app

        await fillFreshText(screen.getByTestId(id('et_login_email')), 'nobody@unknown.com');
        await dismissKeyboard();
        await fillFreshText(screen.getByTestId(id('et_login_password')), USER.oldPassword);
        await dismissKeyboard();
        await screen.getByTestId(id('btn_login')).tap();
        await sleep(4_000);

        // Must stay on login screen
        await expect(screen.getByLabel('Sign In Title')).toBeVisible({ timeout: 5_000 });
        const errorShown = await waitForErrorVisible(ERROR.noAccount, 5_000);
        expect(errorShown).toBe(true);
    });

    test('blocks login with empty email field', { tag: ['@negative'] }, async ({ screen, device }) => {
        const {
            id, freshLaunchToLogin,
            fillFreshText, dismissKeyboard, waitForErrorVisible,
        } = createHelpers(screen, device, APP_ID);

        await freshLaunchToLogin();

        // Leave email empty, fill only password
        await fillFreshText(screen.getByTestId(id('et_login_password')), USER.oldPassword);
        await dismissKeyboard();
        await screen.getByTestId(id('btn_login')).tap();
        await sleep(2_000);

        await expect(screen.getByLabel('Sign In Title')).toBeVisible({ timeout: 5_000 });
        const errorShown = await waitForErrorVisible(ERROR.emailRequired, 5_000);
        expect(errorShown).toBe(true);
    });

    test('blocks login with empty password field', { tag: ['@negative'] }, async ({ screen, device }) => {
        const {
            id, freshLaunchToLogin,
            fillFreshText, dismissKeyboard, waitForErrorVisible,
        } = createHelpers(screen, device, APP_ID);

        await freshLaunchToLogin();

        // Fill only email, leave password empty 
        await fillFreshText(screen.getByTestId(id('et_login_email')), USER.email);
        await dismissKeyboard();
        await screen.getByTestId(id('btn_login')).tap();
        await sleep(2_000);

        await expect(screen.getByLabel('Sign In Title')).toBeVisible({ timeout: 5_000 });
        const errorShown = await waitForErrorVisible(ERROR.passwordRequired, 5_000);
        expect(errorShown).toBe(true);
    });

    test('blocks login with both fields empty', { tag: ['@negative'] }, async ({ screen, device }) => {
        const { id, freshLaunchToLogin, waitForErrorVisible } = createHelpers(screen, device, APP_ID);

        await freshLaunchToLogin();

        // Tap Login without filling anything
        await screen.getByTestId(id('btn_login')).tap();
        await sleep(2_000);

        await expect(screen.getByLabel('Sign In Title')).toBeVisible({ timeout: 5_000 });
        const errorShown = await waitForErrorVisible(ERROR.emailRequired, 5_000);
        expect(errorShown).toBe(true);
    });

    test('rejects invalid email format', { tag: ['@negative'] }, async ({ screen, device }) => {
        const {
            id, freshLaunchToLogin,
            fillFreshText, dismissKeyboard, waitForErrorVisible,
        } = createHelpers(screen, device, APP_ID);

        await freshLaunchToLogin();

        await fillFreshText(screen.getByTestId(id('et_login_email')), 'notanemail');
        await dismissKeyboard();
        await fillFreshText(screen.getByTestId(id('et_login_password')), USER.oldPassword);
        await dismissKeyboard();
        await screen.getByTestId(id('btn_login')).tap();
        await sleep(3_000);

        // Must stay on login screen — invalid format should be caught before any API call
        await expect(screen.getByLabel('Sign In Title')).toBeVisible({ timeout: 5_000 });
        const errorShown = await waitForErrorVisible(ERROR.emailInvalid, 5_000);
        expect(errorShown).toBe(true);
    });

    test('rejects old password after password change', { tag: ['@negative'] }, async ({ screen, device }) => {
        test.setTimeout(300_000);
        const {
            id, freshLaunchToLogin, registerAndGoToLogin, loginAndGoToProfile,
            fillFreshText, dismissKeyboard, findVisibleElement,
            tapUpdatePasswordAndReturnToProfile, waitForErrorVisible,
        } = createHelpers(screen, device, APP_ID);

        // ── Setup: register → login → change password → logout ───────────────
        await freshLaunchToLogin();
        await screen.getByLabel('Create Account Button').tap();
        await registerAndGoToLogin();
        await loginAndGoToProfile();

        // Navigate to Change Password
        const changePasswordButton = await findVisibleElement([
            { name: 'btn_change_password (testId)',   locator: screen.getByTestId(id('btn_change_password')) },
            { name: 'Change Password Button (label)', locator: screen.getByLabel('Change Password Button') },
        ], 8);
        await changePasswordButton.tap();
        await expect(screen.getByLabel('Change Password Section')).toBeVisible({ timeout: 20_000 });

        await fillFreshText(screen.getByTestId(id('et_current_password')), USER.oldPassword);
        await dismissKeyboard();
        await fillFreshText(screen.getByTestId(id('et_new_password')), USER.newPassword);
        await dismissKeyboard();
        await fillFreshText(screen.getByTestId(id('et_confirm_new_password')), USER.newPassword);
        await dismissKeyboard();

        await tapUpdatePasswordAndReturnToProfile(); // password is now USER.newPassword

        // Logout
        const logoutButton = await findVisibleElement([
            { name: 'btn_logout (testId)',   locator: screen.getByTestId(id('btn_logout')) },
            { name: 'Logout Button (label)', locator: screen.getByLabel('Logout Button') },
        ], 8);
        await logoutButton.tap();
        await expect(screen.getByLabel('Sign In Title')).toBeVisible({ timeout: 20_000 });

        // ── Attempt login with the OLD (now invalid) password ─────────────────
        await fillFreshText(screen.getByTestId(id('et_login_email')), USER.email);
        await dismissKeyboard();
        await fillFreshText(screen.getByTestId(id('et_login_password')), USER.oldPassword);
        await dismissKeyboard();
        await screen.getByTestId(id('btn_login')).tap();
        await sleep(4_000);

        // Must stay on login — old password should no longer work
        await expect(screen.getByLabel('Sign In Title')).toBeVisible({ timeout: 5_000 });
        const errorShown = await waitForErrorVisible(ERROR.invalidCredentials, 5_000);
        expect(errorShown).toBe(true);
    });

});

test.describe('Negative: Change Password', () => {
    test.describe.configure({ timeout: 180_000 });

    test('rejects wrong current password', { tag: ['@negative'] }, async ({ screen, device }) => {
        const {
            id, freshLaunchToLogin, registerAndGoToLogin, loginAndGoToProfile,
            fillFreshText, dismissKeyboard, findVisibleElement, waitForErrorVisible,
        } = createHelpers(screen, device, APP_ID);

        await freshLaunchToLogin();
        await screen.getByLabel('Create Account Button').tap();
        await registerAndGoToLogin();
        await loginAndGoToProfile();

        const changePasswordButton = await findVisibleElement([
            { name: 'btn_change_password (testId)',   locator: screen.getByTestId(id('btn_change_password')) },
            { name: 'Change Password Button (label)', locator: screen.getByLabel('Change Password Button') },
        ], 8);
        await changePasswordButton.tap();
        await expect(screen.getByLabel('Change Password Section')).toBeVisible({ timeout: 20_000 });

        await fillFreshText(screen.getByTestId(id('et_current_password')), 'WrongCurrentPass999');
        await dismissKeyboard();
        await fillFreshText(screen.getByTestId(id('et_new_password')), USER.newPassword);
        await dismissKeyboard();
        await fillFreshText(screen.getByTestId(id('et_confirm_new_password')), USER.newPassword);
        await dismissKeyboard();

        await screen.getByTestId(id('btn_update_password')).tap();
        await sleep(4_000);

        // Must stay on change password screen
        await expect(screen.getByLabel('Change Password Section')).toBeVisible({ timeout: 5_000 });
        const errorShown = await waitForErrorVisible(ERROR.currentPasswordWrong, 5_000);
        expect(errorShown).toBe(true);
    });

    test('rejects mismatched new passwords', { tag: ['@negative'] }, async ({ screen, device }) => {
        const {
            id, freshLaunchToLogin, registerAndGoToLogin, loginAndGoToProfile,
            fillFreshText, dismissKeyboard, findVisibleElement, waitForErrorVisible,
        } = createHelpers(screen, device, APP_ID);

        await freshLaunchToLogin();
        await screen.getByLabel('Create Account Button').tap();
        await registerAndGoToLogin();
        await loginAndGoToProfile();

        const changePasswordButton = await findVisibleElement([
            { name: 'btn_change_password (testId)',   locator: screen.getByTestId(id('btn_change_password')) },
            { name: 'Change Password Button (label)', locator: screen.getByLabel('Change Password Button') },
        ], 8);
        await changePasswordButton.tap();
        await expect(screen.getByLabel('Change Password Section')).toBeVisible({ timeout: 20_000 });

        await fillFreshText(screen.getByTestId(id('et_current_password')), USER.oldPassword);
        await dismissKeyboard();
        await fillFreshText(screen.getByTestId(id('et_new_password')), USER.newPassword);
        await dismissKeyboard();
        await fillFreshText(screen.getByTestId(id('et_confirm_new_password')), 'DifferentPass999');
        await dismissKeyboard();

        await screen.getByTestId(id('btn_update_password')).tap();
        await sleep(3_000);

        // Must stay on change password screen
        await expect(screen.getByLabel('Change Password Section')).toBeVisible({ timeout: 5_000 });
        const errorShown = await waitForErrorVisible(ERROR.passwordsMismatch, 5_000);
        expect(errorShown).toBe(true);
    });

});
