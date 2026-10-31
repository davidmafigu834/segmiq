package com.segmiq.sales.native

import com.segmiq.sales.core.phone.PhoneNumbers
import org.junit.Assert.*
import org.junit.Test

class PhoneNumbersTest {
    @Test fun zimbabweNationalAndInternationalAreTheSameSubscriber() {
        assertTrue(PhoneNumbers.sameSubscriber("0771234501", "+263771234501", "ZW"))
        assertEquals("ZW", PhoneNumbers.region("Zimbabwe"))
        assertEquals("ZW", PhoneNumbers.region("zw"))
    }

    @Test fun shortSuffixIsNotAMatch() {
        assertFalse(PhoneNumbers.sameSubscriber("0771234501", "1234501", "ZW"))
        assertFalse(PhoneNumbers.sameSubscriber("0771234501", "0779994501", "ZW"))
    }

    @Test fun internationalNumberIsKeptWhenRegionDoesNotApply() {
        assertFalse(PhoneNumbers.sameSubscriber("+14155552671", "0771234501", "ZW"))
        assertTrue(PhoneNumbers.dialable(" +1 (415) 555-2671 ") .startsWith("+1"))
        assertTrue(PhoneNumbers.display("+14155552671", "US").contains("415"))
    }

    @Test fun unknownCountryDoesNotGuessANationalMatch() {
        assertEquals("ZZ", PhoneNumbers.region("Atlantis"))
        assertFalse(PhoneNumbers.sameSubscriber("0771234501", "+263771234501", "ZZ"))
    }
}
