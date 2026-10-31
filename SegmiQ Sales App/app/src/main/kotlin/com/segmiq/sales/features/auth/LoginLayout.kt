package com.segmiq.sales.features.auth

/** Short windows and the keyboard collapse the decorative header so sign-in stays reachable. */
fun loginUsesCompactLayout(screenHeightDp: Int, keyboardOpen: Boolean): Boolean =
    keyboardOpen || screenHeightDp < 700
