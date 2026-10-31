package com.segmiq.sales.features.realestate

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.segmiq.sales.core.bootstrap.*
import com.segmiq.sales.core.live.*
import com.segmiq.sales.features.live.*
import com.segmiq.sales.ui.theme.SegmiQSalesTheme

/** Fictional design fixtures. Never selected by preferences or used by a live repository. */
private fun previewWorkspace(): LiveWorkspace {
    val modules = listOf("LISTINGS", "BUYERS", "LEADS", "VIEWINGS", "TASKS", "WHATSAPP", "INTRODUCTIONS")
    return LiveWorkspace.from(SalesAppBootstrap(
        schemaVersion = 1,
        user = BootstrapUser("preview-agent", "Tariro Moyo", "SALESPERSON"),
        organisation = BootstrapOrganisation("preview-org", "Fictional Property Agency", workspaceMode = "demo"),
        subscription = BootstrapSubscription(),
        experience = BootstrapExperience("REAL_ESTATE"),
        capabilities = BootstrapCapabilities(modules),
        navigation = BootstrapNavigation(destinations = modules.map { NavDestination(it, it) }),
        salesConfiguration = SalesConfiguration(timeZone = TimeZoneConfig(effective = "Africa/Harare"),
            currency = CurrencyConfig(quotationDefault = "USD")),
    ))
}

@OptIn(ExperimentalMaterial3Api::class)
@Preview(name = "Agent Home · fictional demo", widthDp = 360, heightDp = 800, showBackground = true)
@Preview(name = "Agent Home · larger text", widthDp = 360, heightDp = 800, fontScale = 1.5f, showBackground = true)
@Preview(name = "Agent Home · tablet", widthDp = 700, heightDp = 1000, showBackground = true)
@Composable
private fun AgentHomePreview() {
    SegmiQSalesTheme(darkTheme = false) {
        Scaffold(containerColor = EstateIvory,
            topBar = { Column { TopAppBar(title = { EstateBrandTitle() }); Text("FICTIONAL DEMO · DESIGN PREVIEW", Modifier.padding(16.dp)) } },
            bottomBar = { NavigationBar { previewWorkspace().navigation.tabs.forEach { tab ->
                NavigationBarItem(tab.module == LiveModule.MY_DAY, {}, icon = { Icon(tab.icon.vector(), null) }, label = { Text(tab.label) })
            } } }) { padding ->
            Box(Modifier.padding(padding)) {
                RealEstateHomeContent(
                    MyDayState(
                        dashboard = Loadable(SalesDashboardDto(commercial = DashboardCommercial(newEnquiriesToday = 4, followUpsDueToday = 6))),
                        workspace = Loadable(DailyWorkspaceDto(greetingPart = "morning", openCount = 3,
                            actions = listOf(SalesTaskDto("preview-task", "preview-lead", "Confirm tomorrow's viewing",
                                relatedName = "Fictional buyer", typeLabel = "Follow-up")))),
                        tasks = Loadable(SalesTasksDto()),
                    ), previewWorkspace(), {}, {},
                )
            }
        }
    }
}

@Preview(name = "Agent Home · dark", widthDp = 360, heightDp = 800, showBackground = true)
@Composable
private fun AgentHomeDarkPreview() {
    SegmiQSalesTheme(darkTheme = true) {
        Surface {
            RealEstateHomeContent(MyDayState(workspace = Loadable(DailyWorkspaceDto()),
                dashboard = Loadable(SalesDashboardDto()), tasks = Loadable(SalesTasksDto())), previewWorkspace(), {}, {})
        }
    }
}
