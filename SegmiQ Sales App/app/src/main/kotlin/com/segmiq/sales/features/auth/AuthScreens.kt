package com.segmiq.sales.features.auth

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Lock
import androidx.compose.material.icons.rounded.MailOutline
import androidx.compose.material.icons.rounded.Visibility
import androidx.compose.material.icons.rounded.VisibilityOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.autofill.ContentType
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.contentType
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import com.segmiq.sales.R
import com.segmiq.sales.core.design.SegmiqArtwork
import com.segmiq.sales.core.design.SegmiqDarkSystemBars
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.ui.graphics.graphicsLayer
import com.segmiq.sales.app.session.AppState
import com.segmiq.sales.app.session.BlockReason
import com.segmiq.sales.app.session.SignInUi
import com.segmiq.sales.ui.theme.Lime

private val Night = Color(0xFF070A09)
private val FieldSurface = Color(0xFF0F1513)
private val FieldBorder = Color(0xFF26302B)
private val TextHigh = Color(0xFFF4F7F2)
private val TextLow = Color(0xFF9AA59D)
private val Emerald = Color(0xFF0E7A4E)
private val ErrorText = Color(0xFFFF9AA1)

/** Near-black brand backdrop with soft emerald and lime light, used by every pre-workspace screen. */
@Composable
fun AuthBackdrop(compact: Boolean = false, content: @Composable ColumnScope.() -> Unit) {
    SegmiqDarkSystemBars()
    Box(
        Modifier.fillMaxSize().background(Night).drawBehind {
            drawCircle(
                Brush.radialGradient(listOf(Emerald.copy(alpha = 0.38f), Color.Transparent),
                    center = Offset(size.width * 0.05f, size.height * 0.08f), radius = size.width * 0.95f),
                radius = size.width * 0.95f, center = Offset(size.width * 0.05f, size.height * 0.08f),
            )
            drawCircle(
                Brush.radialGradient(listOf(Lime.copy(alpha = 0.10f), Color.Transparent),
                    center = Offset(size.width * 0.95f, size.height * 0.92f), radius = size.width * 0.8f),
                radius = size.width * 0.8f, center = Offset(size.width * 0.95f, size.height * 0.92f),
            )
        }
    ) {
        if (!compact) SegmiqArtwork(R.drawable.segmiq_sales_login_architecture, Modifier.matchParentSize())
        Box(Modifier.matchParentSize().background(Brush.verticalGradient(listOf(
            Night.copy(alpha = if (compact) .82f else .45f),
            Night.copy(alpha = if (compact) .92f else .80f),
            Night,
        ))))
        Column(
            Modifier.widthIn(max = 520.dp).fillMaxSize().safeDrawingPadding().imePadding().navigationBarsPadding()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp, vertical = if (compact) 8.dp else 20.dp)
                .align(Alignment.TopCenter),
            verticalArrangement = Arrangement.spacedBy(if (compact) 8.dp else 16.dp),
            content = content,
        )
    }
}

@Composable
private fun BrandHeader() {
    var revealed by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { revealed = true }
    val alpha by animateFloatAsState(if (revealed) 1f else 0f, tween(220), label = "Brand reveal")
    Spacer(Modifier.height(12.dp))
    Image(
        painterResource(R.drawable.segmiq_official_logo_transparent),
        contentDescription = "SegmiQ",
        modifier = Modifier.width(172.dp).graphicsLayer { this.alpha = alpha },
    )
    Text("SALES", color = Lime, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold)
}

@Composable
private fun brandFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedTextColor = TextHigh, unfocusedTextColor = TextHigh, disabledTextColor = TextLow,
    focusedContainerColor = FieldSurface, unfocusedContainerColor = FieldSurface, disabledContainerColor = FieldSurface,
    focusedBorderColor = Lime, unfocusedBorderColor = FieldBorder, errorBorderColor = ErrorText,
    focusedLabelColor = Lime, unfocusedLabelColor = TextLow, cursorColor = Lime,
    focusedLeadingIconColor = TextHigh, unfocusedLeadingIconColor = TextLow,
    focusedTrailingIconColor = TextHigh, unfocusedTrailingIconColor = TextLow,
)

@Composable
private fun BrandButton(text: String, busyText: String, busy: Boolean, onClick: () -> Unit) {
    Button(
        onClick = onClick, enabled = !busy,
        modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp)
            .semantics { if (busy) contentDescription = busyText },
        shape = RoundedCornerShape(18.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = Lime, contentColor = Night,
            disabledContainerColor = Lime.copy(alpha = 0.55f), disabledContentColor = Night,
        ),
    ) {
        if (busy) {
            CircularProgressIndicator(Modifier.size(20.dp), color = Night, strokeWidth = 2.dp)
            Spacer(Modifier.width(12.dp))
            Text(busyText, fontWeight = FontWeight.SemiBold)
        } else {
            Text(text, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
private fun ErrorLine(message: String?) {
    if (message != null) {
        Text(message, color = ErrorText, style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.semantics { liveRegion = LiveRegionMode.Assertive })
    }
}

@Composable
private fun NoticeCard(text: String) {
    Surface(color = FieldSurface, contentColor = TextHigh, shape = RoundedCornerShape(16.dp),
        modifier = Modifier.fillMaxWidth().semantics { liveRegion = LiveRegionMode.Polite }) {
        Text(text, Modifier.padding(14.dp), style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable
fun LoginScreen(
    notice: String?,
    ui: SignInUi,
    serverHost: String,
    onSignIn: (String, String) -> Unit,
    onEdit: () -> Unit,
    onExploreDemo: () -> Unit,
    forgotPasswordUrl: String,
) {
    var email by rememberSaveable { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var visible by rememberSaveable { mutableStateOf(false) }
    val focus = LocalFocusManager.current
    val uri = LocalUriHandler.current
    val keyboardOpen = WindowInsets.ime.getBottom(androidx.compose.ui.platform.LocalDensity.current) > 0
    val compact = loginUsesCompactLayout(LocalConfiguration.current.screenHeightDp, keyboardOpen)
    val submit = { focus.clearFocus(); onSignIn(email, password) }

    AuthBackdrop(compact) {
        if (compact) {
            Image(painterResource(R.drawable.segmiq_official_logo_transparent), "SegmiQ", Modifier.width(128.dp))
        } else {
            BrandHeader()
            Spacer(Modifier.height(8.dp))
        }
        Text(if (compact) "Sign in to SegmiQ" else "Sign in to your sales workspace", color = TextHigh,
            style = if (compact) MaterialTheme.typography.headlineSmall else MaterialTheme.typography.headlineLarge,
            modifier = Modifier.semantics { heading() })
        if (!compact) Text("Your conversations, customers and next steps. One authorised workspace.",
            color = TextLow, style = MaterialTheme.typography.bodyLarge)
        if (notice != null) NoticeCard(notice)
        OutlinedTextField(
            value = email, onValueChange = { email = it; onEdit() },
            modifier = Modifier.fillMaxWidth().semantics { contentType = ContentType.EmailAddress + ContentType.Username },
            label = { Text("Work email") }, singleLine = true, enabled = !ui.busy,
            leadingIcon = { Icon(Icons.Rounded.MailOutline, null) },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Next, autoCorrectEnabled = false),
            shape = RoundedCornerShape(16.dp), colors = brandFieldColors(),
        )
        OutlinedTextField(
            value = password, onValueChange = { password = it; onEdit() },
            modifier = Modifier.fillMaxWidth().semantics { contentType = ContentType.Password },
            label = { Text("Password") }, singleLine = true, enabled = !ui.busy,
            leadingIcon = { Icon(Icons.Rounded.Lock, null) },
            trailingIcon = {
                IconButton({ visible = !visible }) {
                    Icon(if (visible) Icons.Rounded.VisibilityOff else Icons.Rounded.Visibility,
                        contentDescription = if (visible) "Hide password" else "Show password")
                }
            },
            visualTransformation = if (visible) VisualTransformation.None else PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Done, autoCorrectEnabled = false),
            keyboardActions = KeyboardActions(onDone = { submit() }),
            isError = ui.error != null,
            shape = RoundedCornerShape(16.dp), colors = brandFieldColors(),
        )
        ErrorLine(ui.error)
        BrandButton("Sign in", "Signing in…", ui.busy) { submit() }
        TextButton({ uri.openUri(forgotPasswordUrl) }, enabled = !ui.busy) {
            Text("Forgot your password? Reset it on the SegmiQ website", color = TextHigh)
        }
        HorizontalDivider(color = FieldBorder, modifier = Modifier.padding(vertical = 4.dp))
        OutlinedButton(onExploreDemo, Modifier.fillMaxWidth().heightIn(min = 52.dp), enabled = !ui.busy,
            shape = RoundedCornerShape(18.dp),
            colors = ButtonDefaults.outlinedButtonColors(contentColor = TextHigh),
            border = BorderStroke(1.dp, FieldBorder)) {
            Text("Explore local demo")
        }
        Text(if (compact) "Fictional customers, stored only on this phone." else "The demo uses fictional customers stored only on this device. Nothing is sent to SegmiQ.",
            color = TextLow, style = MaterialTheme.typography.bodyMedium)
        Spacer(Modifier.height(8.dp))
        Text("Secure connection to $serverHost", color = TextLow, style = MaterialTheme.typography.labelSmall)
    }
}

@Composable
fun MfaScreen(email: String, ui: SignInUi, onSubmit: (String, Boolean) -> Unit, onEdit: () -> Unit, onCancel: () -> Unit) {
    var code by remember { mutableStateOf("") }
    var recovery by rememberSaveable { mutableStateOf(false) }
    val focus = LocalFocusManager.current
    val submit = { focus.clearFocus(); onSubmit(code, recovery) }
    AuthBackdrop {
        BrandHeader()
        Spacer(Modifier.height(8.dp))
        Text("Two-step verification", color = TextHigh, style = MaterialTheme.typography.displaySmall,
            modifier = Modifier.semantics { heading() })
        Text(
            if (recovery) "Enter one of your recovery codes for $email."
            else "Enter the 6-digit code from your authenticator app for $email.",
            color = TextLow, style = MaterialTheme.typography.bodyLarge,
        )
        OutlinedTextField(
            value = code,
            onValueChange = { value -> code = if (recovery) value.take(64) else value.filter(Char::isDigit).take(6); onEdit() },
            modifier = Modifier.fillMaxWidth().semantics { contentType = ContentType.SmsOtpCode },
            label = { Text(if (recovery) "Recovery code" else "Verification code") },
            singleLine = true, enabled = !ui.busy, isError = ui.error != null,
            keyboardOptions = KeyboardOptions(
                keyboardType = if (recovery) KeyboardType.Ascii else KeyboardType.NumberPassword,
                imeAction = ImeAction.Done, autoCorrectEnabled = false,
            ),
            keyboardActions = KeyboardActions(onDone = { submit() }),
            shape = RoundedCornerShape(16.dp), colors = brandFieldColors(),
        )
        ErrorLine(ui.error)
        BrandButton("Verify", "Verifying…", ui.busy) { submit() }
        TextButton({ recovery = !recovery; code = "" }, enabled = !ui.busy) {
            Text(if (recovery) "Use an authenticator code instead" else "Use a recovery code instead", color = TextHigh)
        }
        TextButton(onCancel, enabled = !ui.busy) { Text("Back to sign in", color = TextLow) }
    }
}

@Composable
fun ConnectingScreen(message: String) {
    AuthBackdrop {
        BrandHeader()
        Spacer(Modifier.height(48.dp))
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp),
            modifier = Modifier.semantics(mergeDescendants = true) { liveRegion = LiveRegionMode.Polite }) {
            CircularProgressIndicator(Modifier.size(22.dp), color = Lime, strokeWidth = 2.dp)
            Text(message, color = TextHigh, style = MaterialTheme.typography.titleMedium)
        }
    }
}

@Composable
fun BlockedScreen(state: AppState.Blocked, onRetry: () -> Unit, onSignOut: () -> Unit) {
    val title = when (state.reason) {
        BlockReason.SUBSCRIPTION -> "Subscription suspended"
        BlockReason.SALES_OPERATIONS -> "Sales access paused"
        BlockReason.UPDATE_REQUIRED -> "Update required"
        BlockReason.SERVER_NOT_READY -> "Workspace not available yet"
        BlockReason.CONNECTION -> "Can't reach SegmiQ"
        BlockReason.MFA_ENROLMENT -> "Set up two-step verification"
    }
    AuthBackdrop {
        BrandHeader()
        Spacer(Modifier.height(8.dp))
        Text(title, color = TextHigh, style = MaterialTheme.typography.displaySmall, modifier = Modifier.semantics { heading() })
        Text(state.message, color = TextLow, style = MaterialTheme.typography.bodyLarge,
            modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite })
        if (state.canRetry) BrandButton("Try again", "Checking…", false, onRetry)
        OutlinedButton(onSignOut, Modifier.fillMaxWidth().heightIn(min = 52.dp), shape = RoundedCornerShape(18.dp),
            colors = ButtonDefaults.outlinedButtonColors(contentColor = TextHigh)) {
            Text(if (state.signedIn) "Sign out" else "Back to sign in")
        }
    }
}
