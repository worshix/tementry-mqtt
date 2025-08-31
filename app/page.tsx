"use client"

import type React from "react"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Power, Droplets, Zap } from "lucide-react"

// MQTT client will be imported dynamically to avoid SSR issues
let mqtt: any = null

interface SwitchState {
  power1: boolean
  power2: boolean
  power3: boolean
  pump: boolean
}

export default function MQTTControlPanel() {
  const [client, setClient] = useState<any>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [tankLevel, setTankLevel] = useState(0)
  const [switches, setSwitches] = useState<SwitchState>({
    power1: false,
    power2: false,
    power3: false,
    pump: false,
  })

  // Initialize MQTT client
  useEffect(() => {
    const initMQTT = async () => {
      try {
        // Dynamically import mqtt to avoid SSR issues
        const mqttModule = await import("mqtt")
        mqtt = mqttModule.default || mqttModule

        // Replace with your MQTT broker URL
        const mqttClient = mqtt.connect("ws://localhost:9001/", {
          clientId: "tank-control-panel-" + Math.random().toString(16).substr(2, 8),
          clean: true,
          connectTimeout: 4000,
          reconnectPeriod: 1000,
        })

        mqttClient.on("connect", () => {
          console.log("Connected to MQTT broker")
          setIsConnected(true)
          // Subscribe to tank level updates
          mqttClient.subscribe("/level", (err) => {
            if (err) {
              console.error("Failed to subscribe to /level:", err)
            }
          })
        })

        mqttClient.on("message", (topic: string, message: Buffer) => {
          const messageStr = message.toString()
          console.log(`Received message on ${topic}: ${messageStr}`)

          if (topic === "/level") {
            const level = Number.parseFloat(messageStr)
            if (!isNaN(level)) {
              setTankLevel(Math.max(0, Math.min(100, level)))
            }
          }
        })

        mqttClient.on("error", (err) => {
          console.error("MQTT connection error:", err)
          setIsConnected(false)
        })

        mqttClient.on("close", () => {
          console.log("MQTT connection closed")
          setIsConnected(false)
        })

        setClient(mqttClient)
      } catch (error) {
        console.error("Failed to initialize MQTT:", error)
      }
    }

    initMQTT()

    return () => {
      if (client) {
        client.end()
      }
    }
  }, [])

  const publishSwitchState = useCallback(
    (topic: string, state: boolean) => {
      if (client && isConnected) {
        const message = state ? "on" : "off"
        client.publish(topic, message, (err: any) => {
          if (err) {
            console.error(`Failed to publish to ${topic}:`, err)
          } else {
            console.log(`Published ${message} to ${topic}`)
          }
        })
      }
    },
    [client, isConnected],
  )

  const handleSwitchChange = (switchName: keyof SwitchState, checked: boolean) => {
    setSwitches((prev) => ({ ...prev, [switchName]: checked }))

    const topicMap = {
      power1: "/power1",
      power2: "/power2",
      power3: "/power3",
      pump: "/pump",
    }

    publishSwitchState(topicMap[switchName], checked)
  }

  const getTankLevelColor = (level: number) => {
    if (level < 20) return "bg-red-500"
    if (level < 50) return "bg-yellow-500"
    return "bg-blue-500"
  }

  const getTankLevelStatus = (level: number) => {
    if (level < 20) return "Low"
    if (level < 50) return "Medium"
    return "High"
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-blue-900">Tank Control Panel</h1>
          <div className="flex items-center justify-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`} />
            <span className="text-sm text-blue-700">MQTT {isConnected ? "Connected" : "Disconnected"}</span>
          </div>
        </div>

        {/* Tank Level Monitor */}
        <Card className="border-blue-200 shadow-lg">
          <CardHeader className="bg-blue-500 text-white">
            <CardTitle className="flex items-center gap-2">
              <Droplets className="w-5 h-5" />
              Tank Level Monitor
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-lg font-medium text-blue-900">Current Level</span>
                <Badge
                  variant={tankLevel < 20 ? "destructive" : tankLevel < 50 ? "secondary" : "default"}
                  className={tankLevel >= 50 ? "bg-blue-500 hover:bg-blue-600" : ""}
                >
                  {getTankLevelStatus(tankLevel)}
                </Badge>
              </div>
              <div className="space-y-2">
                <Progress
                  value={tankLevel}
                  className="h-6"
                  style={
                    {
                      "--progress-background": getTankLevelColor(tankLevel),
                    } as React.CSSProperties
                  }
                />
                <div className="flex justify-between text-sm text-blue-700">
                  <span>0%</span>
                  <span className="font-bold text-lg">{tankLevel.toFixed(1)}%</span>
                  <span>100%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Power Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Power Switches */}
          <Card className="border-blue-200 shadow-lg">
            <CardHeader className="bg-blue-500 text-white">
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Power Controls
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {(["power1", "power2", "power3"] as const).map((power) => (
                <div key={power} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Power className={`w-5 h-5 ${switches[power] ? "text-green-600" : "text-gray-400"}`} />
                    <span className="font-medium text-blue-900 capitalize">{power.replace("power", "Power ")}</span>
                  </div>
                  <Switch
                    checked={switches[power]}
                    onCheckedChange={(checked) => handleSwitchChange(power, checked)}
                    disabled={!isConnected}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Pump Control */}
          <Card className="border-blue-200 shadow-lg">
            <CardHeader className="bg-blue-500 text-white">
              <CardTitle className="flex items-center gap-2">
                <Droplets className="w-5 h-5" />
                Pump Control
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Droplets className={`w-6 h-6 ${switches.pump ? "text-blue-600" : "text-gray-400"}`} />
                  <div>
                    <span className="font-medium text-blue-900 block">Water Pump</span>
                    <span className="text-sm text-blue-600">{switches.pump ? "Running" : "Stopped"}</span>
                  </div>
                </div>
                <Switch
                  checked={switches.pump}
                  onCheckedChange={(checked) => handleSwitchChange("pump", checked)}
                  disabled={!isConnected}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Status Footer */}
        <Card className="border-blue-200 shadow-lg">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600">{Object.values(switches).filter(Boolean).length}</div>
                <div className="text-sm text-blue-700">Active Systems</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">{tankLevel.toFixed(0)}%</div>
                <div className="text-sm text-blue-700">Tank Level</div>
              </div>
              <div>
                <div className={`text-2xl font-bold ${isConnected ? "text-green-600" : "text-red-600"}`}>
                  {isConnected ? "ON" : "OFF"}
                </div>
                <div className="text-sm text-blue-700">MQTT Status</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">{switches.pump ? "ON" : "OFF"}</div>
                <div className="text-sm text-blue-700">Pump Status</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
