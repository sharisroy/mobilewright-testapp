import { test, expect } from '@mobilewright/test';

test.setTimeout(600_000);
test.use({ bundleId: 'com.haris.testapp' });
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// After submitting a form with password fields, Android may show a "Save
// password to Google?" autofill bottom sheet that covers the screen and
// auto-dismisses itself after a few seconds. Poll for its "Never" button
// (android:id/autofill_save_no) and dismiss it as soon as it appears.

const dismissSavePasswordDialog = async (screen: any, maxWaitMs = 8000) => {
    const neverButton = screen.getByTestId('android:id/autofill_save_no');
    const deadline = Date.now() + maxWaitMs;
    while (Date.now() < deadline) {
        if (await neverButton.isVisible({ timeout: 0 }).catch(() => false)) {
            await neverButton.tap();
            await sleep(500);
            return;
        }
        await sleep(300);
    }
};

// ── Test ──────────────────────────────────────────────────────────────────────

test('list apps installed on test device', { tag: ['@smoke',  '@gitAction'] }, async ({ device }, testInfo) => {
    const apps = await device.listApps();

    console.log(`Installed apps (${apps.length}):`);
    for (const app of apps) {
        console.log(`- ${app.name ?? '(unknown)'} (${app.bundleId})`);
    }

    testInfo.annotations.push({ type: 'Installed Apps Count', description: String(apps.length) });

    const testApp = apps.find((app) => app.bundleId === 'com.haris.testapp');
    expect(testApp).toBeTruthy();
});

test('basic user flow: register, login, and update profile', { tag: ['@regression', '@gitAction'] }, async ({ screen, device }) => {

    // ── Launch app ────────────────────────────────────────────────────────
    await device.launchApp('com.haris.testapp');
    await expect(screen.getByLabel('App Name')).toBeVisible({ timeout: 15_000 });

    // ── Home screen ───────────────────────────────────────────────────────
    console.log('----------- Home Screen -----------');

    const appName = await screen.getByLabel('App Name').getText();
    console.log('App name:', appName);
    expect(appName).toBe('Test Application');

    const appTagline = await screen.getByLabel('App Tagline').getText();
    console.log('App tagline:', appTagline);
    expect(appTagline).toBe('Manage your personal information');

    const signInTitle = await screen.getByLabel('Sign In Title').getText();
    console.log('Sign in title:', signInTitle);
    expect(signInTitle).toBe('Sign In');

    const signInSubtitle = await screen.getByLabel('Sign In Subtitle').getText();
    console.log('Sign in subtitle:', signInSubtitle);
    expect(signInSubtitle).toBe('Sign in to access your profile');

    const emailText = await screen.getByTestId('com.haris.testapp:id/et_login_email').getText();
    console.log('Email field:', emailText);
    expect(emailText).toBe('Email Address *');

    const passwordText = await screen.getByTestId('com.haris.testapp:id/et_login_password').getText();
    console.log('Password field:', passwordText);
    expect(passwordText).toBe('Password *');

    const showPasswordBtn = screen.getByLabel('Show password');
    if (await showPasswordBtn.isVisible().catch(() => false)) {
        const showPasswordText = await showPasswordBtn.getText();
        console.log('Show password button:', showPasswordText);
        expect(showPasswordText).toBe('Show password');
    } else {
        console.log('Show password button not found, skipping that assertion');
    }

    const loginText = await screen.getByTestId('com.haris.testapp:id/btn_login').getText();
    console.log('Login button:', loginText);
    expect(loginText).toBe('Login');

    const orText = await screen.getByText('OR').getText();
    console.log('Or label:', orText);
    expect(orText).toBe('OR');

    const createAccountText = await screen.getByTestId('com.haris.testapp:id/btn_home_register').getText();
    console.log('Create account button:', createAccountText);
    expect(createAccountText).toBe('Create Account');

    await screen.getByLabel('Create Account Button').tap();

    // ── Registration ──────────────────────────────────────────────────────
    console.log('----------- Registration Screen -----------');

    const reg_create_account = await screen.getByText('Create Account').getText();
    console.log('Create account Screen Title Text:', reg_create_account);
    expect(reg_create_account).toBe('Create Account');

    const reg_create_your_account_heading = await screen.getByLabel('Create Account Heading').getText();
    console.log('Create Account Heading text:', reg_create_your_account_heading);
    expect(reg_create_your_account_heading).toBe('Create your account');

    const fullNameText = await screen.getByLabel('Full Name Edit Text').getText();
    console.log('Full Name text:', fullNameText);
    expect(fullNameText).toBe('Full Name *');

    const emailAddressText = await screen.getByLabel('Email Edit Text').getText();
    console.log('Email Address text:', emailAddressText);
    expect(emailAddressText).toBe('Email Address *');

    const passwordLabelText = await screen.getByLabel('Password Edit Text').getText();
    console.log('Password text:', passwordLabelText);
    expect(passwordLabelText).toBe('Password *');

    const regshowPasswordBtn = screen.getByLabel('Show password');
    if (await regshowPasswordBtn.isVisible().catch(() => false)) {
        const regshowPasswordText = await regshowPasswordBtn.getText();
        console.log('Show password button:', regshowPasswordText);
        expect(regshowPasswordText).toBe('Show password');
    } else {
        console.log('Show password button not found, skipping that assertion');
    }

    const confpasswordLabelText = await screen.getByLabel('Confirm Password Edit Text').getText();
    console.log('Confirm Password text:', confpasswordLabelText);
    expect(confpasswordLabelText).toBe('Confirm Password *');

    const regsConfirmPasswordShowPasswordBtn = screen.getByLabel('Show password');
    if (await regsConfirmPasswordShowPasswordBtn.isVisible().catch(() => false)) {
        const regsConfirmPasswordShowPasswordText = await regsConfirmPasswordShowPasswordBtn.getText();
        console.log('Show password button:', regsConfirmPasswordShowPasswordText);
        expect(regsConfirmPasswordShowPasswordText).toBe('Show password');
    } else {
        console.log('Show confirm password button not found, skipping that assertion');
    }

    const regButton = await screen.getByTestId('com.haris.testapp:id/btn_submit').getText();
    console.log('Register button:', regButton);
    expect(regButton).toBe('Register');

    const alreadyHaveAccountText = await screen.getByTestId('com.haris.testapp:id/btn_back_to_home').getText();
    console.log('Already have an account text:', alreadyHaveAccountText);
    expect(alreadyHaveAccountText).toBe('Already have an account? Login');

    await screen.getByLabel('Full Name Edit Text').fill("Haris Roy");
    await screen.getByLabel('Email Edit Text').fill("haris@mail.com");
    await screen.getByLabel('Password Edit Text').fill("Password123");
    await screen.getByLabel('Confirm Password Edit Text').fill("Password123");

    await screen.pressButton('BACK').catch(() => { });
    await sleep(500);

    console.log('----------- Filled registration form -----------');

    const getInputName = await screen.getByLabel('Full Name Edit Text').getText();
    console.log('Name:', getInputName);
    expect(getInputName).toBe("Haris Roy");

    const getInputEmail = await screen.getByTestId('com.haris.testapp:id/et_email').getText();
    console.log('Email:', getInputEmail);
    expect(getInputEmail).toBe("haris@mail.com");

    const getInputPassword = await screen.getByLabel('Password Edit Text').getText();
    console.log('Password:', getInputPassword);
    expect(getInputPassword).toBe("Password123");

    await screen.getByLabel('Show password').tap();
    const showPasswordText = await screen.getByLabel('Show password').getText();
    console.log('Show password button:', showPasswordText);
    expect(showPasswordText).toBe('Show password');

    const getInputConfirmPassword = await screen.getByLabel('Confirm Password Edit Text').getText();
    console.log('Confirm Password:', getInputConfirmPassword);
    expect(getInputConfirmPassword).toBe("Password123");

    await screen.getByLabel('Register Button').tap();
    await dismissSavePasswordDialog(screen);
    await sleep(1000);

    // ── Login ─────────────────────────────────────────────────────────────

    await screen.getByTestId('com.haris.testapp:id/et_login_email').fill("haris@mail.com");

    // Dismiss the on-screen keyboard before filling the password field — it
    // can overlap the password field's tap target and cause the typed text
    // to land in the still-focused email field instead.
    await screen.pressButton('BACK').catch(() => { });
    await sleep(300);

    await screen.getByTestId('com.haris.testapp:id/et_login_password').fill("Password123");

    await screen.pressButton('BACK').catch(() => { });
    await sleep(500);

    console.log('----------- Filled Login form -----------');

    const loginEmailValue = await screen.getByTestId('com.haris.testapp:id/et_login_email').getText();
    console.log('Login email:', loginEmailValue);
    expect(loginEmailValue).toBe("haris@mail.com");

    const loginPasswordValue = await screen.getByTestId('com.haris.testapp:id/et_login_password').getText();
    console.log('Login password:', loginPasswordValue);
    expect(loginPasswordValue).toBe("Password123");

    await screen.getByTestId('com.haris.testapp:id/btn_login').tap();
    await sleep(1000);

    // ── Profile screen ────────────────────────────────────────────────────
    console.log('----------- Profile Screen Verification -----------');

    const profileScreenTitle = await screen.getByText('My Profile').getText();
    console.log('Profile screen title:', profileScreenTitle);
    expect(profileScreenTitle).toBe('My Profile');

    await expect(screen.getByLabel('User Avatar')).toBeVisible();

    const profileName = await screen.getByLabel('Profile Name').getText();
    console.log('Profile name:', profileName);
    expect(profileName).toBe('Haris Roy');

    const profileEmail = await screen.getByLabel('Profile Email').getText();
    console.log('Profile email:', profileEmail);
    expect(profileEmail).toBe('haris@mail.com');

    await expect(screen.getByLabel('User Header Card')).toBeVisible();

    const profileInfoTitle = await screen.getByLabel('Profile Details Title').getText();
    console.log('Profile info title:', profileInfoTitle);
    expect(profileInfoTitle).toBe('Profile Information');

    const profileNodes = collectAll(await screen.viewTree());
    const getRowValue = (rowResourceId: string): string => {
        const row = profileNodes.find((n: any) =>
            n.identifier === rowResourceId || n.resourceId === rowResourceId
        );
        if (!row) return '';
        const { y: ry, height: rh } = row.bounds;
        return profileNodes.find((n: any) =>
            n.isVisible &&
            (n.identifier === 'com.haris.testapp:id/tv_row_value' || n.resourceId === 'com.haris.testapp:id/tv_row_value') &&
            n.bounds.y >= ry && n.bounds.y < ry + rh
        )?.text || '';
    };

    const rowNameValue = getRowValue('com.haris.testapp:id/row_full_name');
    console.log('Name row value:', rowNameValue);
    expect(rowNameValue).toBe('Haris Roy');

    const rowEmailValue = getRowValue('com.haris.testapp:id/row_email');
    console.log('Email row value:', rowEmailValue);
    expect(rowEmailValue).toBe('haris@mail.com');

    const rowGenderValue = getRowValue('com.haris.testapp:id/row_gender');
    console.log('Gender row value:', rowGenderValue);
    expect(rowGenderValue).toBe('N/A');

    const rowDobValue = getRowValue('com.haris.testapp:id/row_dob');
    console.log('Date of Birth row value:', rowDobValue);
    expect(rowDobValue).toBe('N/A');

    const rowMaritalValue = getRowValue('com.haris.testapp:id/row_marital_status');
    console.log('Marital status row value:', rowMaritalValue);
    expect(rowMaritalValue).toBe('N/A');

    const rowAddressValue = getRowValue('com.haris.testapp:id/row_address');
    console.log('Address row value:', rowAddressValue);
    expect(rowAddressValue).toBe('N/A');

    const rowCountryValue = getRowValue('com.haris.testapp:id/row_country');
    console.log('Country row value:', rowCountryValue);
    expect(rowCountryValue).toBe('N/A');

    const rowMobileValue = getRowValue('com.haris.testapp:id/row_mobile');
    console.log('Mobile row value:', rowMobileValue);
    expect(rowMobileValue).toBe('N/A');

    await expect(screen.getByLabel('Profile Information Card')).toBeVisible();

    const updateProfileBtn = await screen.getByLabel('Update Profile Button').getText();
    console.log('Update Profile button:', updateProfileBtn);
    expect(updateProfileBtn).toBe('Update Profile');

    const changePasswordBtn = await screen.getByLabel('Change Password Button').getText();
    console.log('Change Password button:', changePasswordBtn);
    expect(changePasswordBtn).toBe('Change Password');

    // ── Update Profile ────────────────────────────────────────────────────
    console.log('----------- Update Profile -----------');

    await screen.getByLabel('Update Profile Button').tap();
    await sleep(1000);

    // Date of Birth
    await screen.getByTestId('com.haris.testapp:id/et_dob').tap();
    await sleep(1000);

    if (await screen.getByText('OK').isVisible().catch(() => false)) {
        await screen.getByText('OK').tap();
    } else {
        await screen.pressButton('ENTER').catch(() => { });
    }
    await sleep(500);

    // Gender — AutoCompleteView popup is not in the accessibility tree, so tap
    // below the field's bottom edge to hit the first dropdown option.
    await screen.getByTestId('com.haris.testapp:id/acv_gender').tap();
    await sleep(800);
    const genderNodes = collectAll(await screen.viewTree());
    const genderNode = genderNodes.find((n: any) =>
        n.identifier === 'com.haris.testapp:id/acv_gender' || n.resourceId === 'com.haris.testapp:id/acv_gender'
    );
    if (!genderNode) throw new Error('Could not find gender dropdown field');
    const { x: gx, y: gy, width: gw, height: gh } = genderNode.bounds;
    await device.driver.tap(Math.round(gx + gw / 2), Math.round(gy + gh + 50));
    await sleep(500);

    await screen.getByTestId('com.haris.testapp:id/rb_single').tap();
    await sleep(300);

    // Address
    const addressField = screen.getByTestId('com.haris.testapp:id/et_address');
    await addressField.tap();
    await addressField.fill('123 Main Street, Dhaka');

    await screen.pressButton('BACK').catch(() => { });
    await sleep(500);

    // Scroll to reveal bottom fields
    for (let i = 0; i < 4; i++) {
        await device.driver.swipe('up', { distance: 400 });
        await sleep(500);
    }

    // Mobile
    const mobileField = await findVisibleElement(device, [
        { name: 'et_mobile full id', locator: screen.getByTestId('com.haris.testapp:id/et_mobile') },
        { name: 'Mobile Number Edit Text', locator: screen.getByLabel('Mobile Number Edit Text') },
    ], 5);
    await mobileField.fill('01712345678');
    await screen.pressButton('BACK').catch(() => { });
    await sleep(500);

    // Terms & Conditions checkbox
    const termsCheckbox = await findVisibleElement(device, [
        { name: 'cb_terms full id', locator: screen.getByTestId('com.haris.testapp:id/cb_terms') },
        { name: 'Accept Terms and Conditions', locator: screen.getByLabel('Accept Terms and Conditions') },
    ], 3);
    await termsCheckbox.tap();
    await sleep(300);

    // Save Profile
    const saveButton = await findVisibleElement(device, [
        { name: 'btn_save_profile full id', locator: screen.getByTestId('com.haris.testapp:id/btn_save_profile') },
        { name: 'Save Profile Button', locator: screen.getByLabel('Save Profile Button') },
    ], 5);
    await saveButton.tap();
    await waitForProfileScreen(screen, 15_000);

    // ── Verify updated profile ────────────────────────────────────────────
    console.log('----------- Profile after update  -----------');

    const postProfileScreenTitle = await screen.getByText('My Profile').getText();
    console.log('Profile screen title:', postProfileScreenTitle);
    expect(postProfileScreenTitle).toBe('My Profile');

    await expect(screen.getByLabel('User Avatar')).toBeVisible();

    const postProfileName = await screen.getByLabel('Profile Name').getText();
    console.log('Profile name:', postProfileName);
    expect(postProfileName).toBe('Haris Roy');

    const postProfileEmail = await screen.getByLabel('Profile Email').getText();
    console.log('Profile email:', postProfileEmail);
    expect(postProfileEmail).toBe('haris@mail.com');

    await expect(screen.getByLabel('User Header Card')).toBeVisible();

    const postProfileInfoTitle = await screen.getByLabel('Profile Details Title').getText();
    console.log('Profile info title:', postProfileInfoTitle);
    expect(postProfileInfoTitle).toBe('Profile Information');

    const postProfileNodes = collectAll(await screen.viewTree());
    const getPostRowValue = (rowResourceId: string): string => {
        const row = postProfileNodes.find((n: any) =>
            n.identifier === rowResourceId || n.resourceId === rowResourceId
        );
        if (!row) return '';
        const { y: ry, height: rh } = row.bounds;
        return postProfileNodes.find((n: any) =>
            n.isVisible &&
            (n.identifier === 'com.haris.testapp:id/tv_row_value' || n.resourceId === 'com.haris.testapp:id/tv_row_value') &&
            n.bounds.y >= ry && n.bounds.y < ry + rh
        )?.text || '';
    };

    const postRowNameValue = getPostRowValue('com.haris.testapp:id/row_full_name');
    console.log('Name row value:', postRowNameValue);
    expect(postRowNameValue).toBe('Haris Roy');

    const postRowEmailValue = getPostRowValue('com.haris.testapp:id/row_email');
    console.log('Email row value:', postRowEmailValue);
    expect(postRowEmailValue).toBe('haris@mail.com');

    const postRowGenderValue = getPostRowValue('com.haris.testapp:id/row_gender');
    console.log('Gender row value:', postRowGenderValue);
    expect(postRowGenderValue).toBe('Male');

    const postRowMaritalValue = getPostRowValue('com.haris.testapp:id/row_marital_status');
    console.log('Marital status row value:', postRowMaritalValue);
    expect(postRowMaritalValue).toBe('Single');

    const postRowAddressValue = getPostRowValue('com.haris.testapp:id/row_address');
    console.log('Address row value:', postRowAddressValue);
    expect(postRowAddressValue).toBe('123 Main Street, Dhaka');

    const postRowMobileValue = getPostRowValue('com.haris.testapp:id/row_mobile');
    console.log('Mobile row value:', postRowMobileValue);
    expect(postRowMobileValue).toBe('01712345678');

    await expect(screen.getByLabel('Profile Information Card')).toBeVisible();

    const postUpdateProfileBtn = await screen.getByLabel('Update Profile Button').getText();
    console.log('Update Profile button:', postUpdateProfileBtn);
    expect(postUpdateProfileBtn).toBe('Update Profile');

    const postChangePasswordBtn = await screen.getByLabel('Change Password Button').getText();
    console.log('Change Password button:', postChangePasswordBtn);
    expect(postChangePasswordBtn).toBe('Change Password');

    console.log('happy path done');
});

type LocatorItem = {
    name: string;
    locator: any;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const collectAll = (nodes: any[], result: any[] = []): any[] => {
    for (const node of nodes) {
        result.push(node);
        if (node.children?.length) collectAll(node.children, result);
    }
    return result;
};

const findVisibleElement = async (
    device: any,
    locators: LocatorItem[],
    maxSwipes = 0
) => {
    for (let i = 0; i <= maxSwipes; i++) {
        for (const item of locators) {
            if (await item.locator.isVisible().catch(() => false)) {
                return item.locator;
            }
        }
        if (i < maxSwipes) {
            await device.driver.swipe('up', { distance: 650 });
            await sleep(500);
        }
    }
    throw new Error(
        `Could not find visible element: ${locators.map(item => item.name).join(', ')}`
    );
};

const dumpVisibleUi = async (screen: any, title: string) => {
    console.log(`\n====== ${title} ======\n`);
    try {
        const nodes = collectAll(await screen.viewTree());
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
    } catch (e) {
        console.log(`[dumpVisibleUi] could not get view tree: ${e}`);
    }
    console.log(`\n====== End ${title} ======\n`);
};

const waitForProfileScreen = async (screen: any, timeout = 20_000) => {
    const visible = await (expect(screen.getByText('My Profile')) as any)
        .toBeVisible({ timeout })
        .then(() => true)
        .catch(() => false);

    if (!visible) {
        await dumpVisibleUi(screen, 'Current UI while waiting for My Profile');
        throw new Error('Expected My Profile screen, but app did not navigate there.');
    }
};

