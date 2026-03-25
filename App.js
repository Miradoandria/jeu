import React, { useState } from "react";
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import ChemistryGame from "./screens/chimestryGame";
import FanoronaGame from "./screens/Fanorona9";

const { width, height } = Dimensions.get("window");

const SCREENS = {
  home: "home",
  chemistry: "chemistry",
  fanorona: "fanorona",
};

export default function App() {
  const [activeScreen, setActiveScreen] = useState(SCREENS.home);

  if (activeScreen === SCREENS.chemistry) {
    return (
      <View style={styles.gameScreen}>
        <LinearGradient
          colors={["#0B1120", "#0F172A", "#111827"]}
          style={styles.gradientBackground}
        />
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setActiveScreen(SCREENS.home)}>
            <Text style={styles.backButtonText}>← Retour</Text>
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>🧪 Chimie Stratégique</Text>
          <View style={styles.topBarSpacer} />
        </View>
        <View style={styles.gameContent}>
          <ChemistryGame />
        </View>
      </View>
    );
  }

  if (activeScreen === SCREENS.fanorana) {
    return (
      <View style={styles.gameScreen}>
        <LinearGradient
          colors={["#0B1120", "#0F172A", "#111827"]}
          style={styles.gradientBackground}
        />
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setActiveScreen(SCREENS.home)}>
            <Text style={styles.backButtonText}>← Retour</Text>
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>⚔️ Fanorona 9</Text>
          <View style={styles.topBarSpacer} />
        </View>
        <View style={styles.gameContent}>
          <FanoronaGame />
        </View>
      </View>
    );
  }

  return (
    <LinearGradient
      colors={["#0F172A", "#1E1B2E", "#0B1120"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Éléments décoratifs */}
      <View style={styles.decorCircle1} />
      <View style={styles.decorCircle2} />
      <View style={styles.decorCircle3} />

      <View style={styles.hero}>
        <Text style={styles.badge}>🎮 MULTIPLATEFORME</Text>
        <Text style={styles.title}>Examen{"\n"}Multiplateforme</Text>
        <View style={styles.divider} />
        <Text style={styles.subtitle}>Choisissez votre jeu</Text>
      </View>

      <View style={styles.menu}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => setActiveScreen(SCREENS.chemistry)}>
          <LinearGradient
            colors={["#3B82F6", "#1E40AF", "#1E3A8A"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.card}>
            <View style={styles.cardIcon}>
              <Text style={styles.cardIconText}>🧪</Text>
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Chimie Stratégique</Text>
              <Text style={styles.cardText}>
                Capturez le territoire dans ce jeu inspiré du laboratoire.
              </Text>
              <View style={styles.cardFooter}>
                <Text style={styles.cardPlay}>Jouer →</Text>
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => setActiveScreen(SCREENS.fanorana)}>
          <LinearGradient
            colors={["#F59E0B", "#B45309", "#92400E"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.card}>
            <View style={styles.cardIcon}>
              <Text style={styles.cardIconText}>⚔️</Text>
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Fanorona 9</Text>
              <Text style={styles.cardText}>
                Découvrez le jeu de stratégie traditionnel malgache.
              </Text>
              <View style={styles.cardFooter}>
                <Text style={styles.cardPlay}>Jouer →</Text>
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Choisissez votre aventure</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  gradientBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  // Éléments décoratifs
  decorCircle1: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "rgba(59, 130, 246, 0.05)",
    top: -150,
    right: -100,
  },
  decorCircle2: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(245, 158, 11, 0.05)",
    bottom: -50,
    left: -80,
  },
  decorCircle3: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "rgba(139, 92, 246, 0.05)",
    bottom: 100,
    right: -50,
  },
  hero: {
    marginBottom: 48,
    alignItems: "center",
  },
  badge: {
    color: "#F59E0B",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1,
    marginBottom: 16,
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    overflow: "hidden",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 44,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 16,
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  divider: {
    width: 60,
    height: 3,
    backgroundColor: "#F59E0B",
    marginBottom: 20,
    borderRadius: 2,
  },
  subtitle: {
    color: "#CBD5E1",
    fontSize: 16,
    fontWeight: "500",
    textAlign: "center",
  },
  menu: {
    gap: 20,
    marginBottom: 32,
  },
  card: {
    borderRadius: 24,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  cardIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  cardIconText: {
    fontSize: 32,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 6,
  },
  cardText: {
    color: "#E2E8F0",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
    opacity: 0.9,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  cardPlay: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
    opacity: 0.9,
  },
  footer: {
    alignItems: "center",
  },
  footerText: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "500",
  },
  gameScreen: {
    flex: 1,
    backgroundColor: "#0F172A",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 16,
    backgroundColor: "rgba(17, 24, 39, 0.95)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  backButton: {
    backgroundColor: "rgba(51, 65, 85, 0.8)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  backButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
  },
  topBarTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  topBarSpacer: {
    width: 70,
  },
  gameContent: {
    flex: 1,
  },
});
