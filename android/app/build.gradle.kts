plugins {
    id("com.android.application")
}

android {
    namespace = "app.myworkoutpal"
    compileSdk = 35

    defaultConfig {
        applicationId = "app.myworkoutpal"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            // Signs release builds with the debug key so the APK installs directly.
            // Replace with your own keystore before publishing to the Play Store.
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("androidx.activity:activity:1.9.3")
    implementation("androidx.core:core:1.13.1")
}
